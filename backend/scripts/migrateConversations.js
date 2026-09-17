/**
 * Migration Script: Migrate to Conversations Schema
 * 1. Creates 'conversations' table
 * 2. Adds 'conversation_id' to 'chat_messages' and 'saved_widgets'
 * 3. Groups legacy messages per user using 3-hour gap rule and assigns conversation_id
 * 4. Links saved_widgets to corresponding conversation_id
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../users.db");
const db = new sqlite3.Database(dbPath);

const THREE_HOURS_SECONDS = 3 * 60 * 60;

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function migrate() {
    console.log("=================================================");
    console.log("🚀 STARTING CONVERSATIONS SCHEMA MIGRATION");
    console.log("=================================================\n");

    try {
        await runQuery("PRAGMA busy_timeout = 5000;");

        // 1. Create conversations table if not exists
        console.log("Step 1: Creating 'conversations' table...");
        await runQuery(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                is_pinned INTEGER DEFAULT 0 CHECK(is_pinned IN (0, 1)),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await runQuery(`CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);`);
        console.log("✅ 'conversations' table ready.");

        // 2. Check if chat_messages has conversation_id column
        console.log("Step 2: Checking 'chat_messages' table columns...");
        const chatColumns = await allQuery("PRAGMA table_info(chat_messages);");
        const hasConvId = chatColumns.some(c => c.name === "conversation_id");

        if (!hasConvId) {
            console.log("Adding 'conversation_id' column to 'chat_messages'...");
            await runQuery("ALTER TABLE chat_messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE;");
            await runQuery("CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_id ON chat_messages(conversation_id, id ASC);");
            console.log("✅ Added 'conversation_id' to 'chat_messages'.");
        } else {
            console.log("ℹ️ 'chat_messages' already has 'conversation_id' column.");
        }

        // 3. Check if saved_widgets has conversation_id column
        console.log("Step 3: Checking 'saved_widgets' table columns...");
        const widgetColumns = await allQuery("PRAGMA table_info(saved_widgets);");
        const hasWidgetConvId = widgetColumns.some(c => c.name === "conversation_id");

        if (!hasWidgetConvId) {
            console.log("Adding 'conversation_id' column to 'saved_widgets'...");
            await runQuery("ALTER TABLE saved_widgets ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL;");
            await runQuery("CREATE INDEX IF NOT EXISTS idx_saved_widgets_conv_id ON saved_widgets(conversation_id);");
            console.log("✅ Added 'conversation_id' to 'saved_widgets'.");
        } else {
            console.log("ℹ️ 'saved_widgets' already has 'conversation_id' column.");
        }

        // 4. Count total messages before migration
        const totalMsgsRow = await getQuery("SELECT COUNT(*) as count FROM chat_messages;");
        const totalMsgs = totalMsgsRow ? totalMsgsRow.count : 0;
        console.log(`Total messages in database: ${totalMsgs}`);

        // 5. Find unassigned messages
        const unassignedMessages = await allQuery(
            "SELECT id, user_id, role, content, created_at FROM chat_messages WHERE conversation_id IS NULL ORDER BY user_id ASC, id ASC;"
        );
        console.log(`Unassigned messages to migrate: ${unassignedMessages.length}`);

        if (unassignedMessages.length > 0) {
            // Group by user
            const messagesByUser = {};
            for (const msg of unassignedMessages) {
                if (!messagesByUser[msg.user_id]) {
                    messagesByUser[msg.user_id] = [];
                }
                messagesByUser[msg.user_id].push(msg);
            }

            let totalConversationsCreated = 0;
            let totalMessagesMigrated = 0;

            for (const [userId, userMsgs] of Object.entries(messagesByUser)) {
                // Group contiguous messages within 3 hours
                const groups = [];
                let currentGroup = [];

                for (let i = 0; i < userMsgs.length; i++) {
                    const msg = userMsgs[i];
                    if (currentGroup.length === 0) {
                        currentGroup.push(msg);
                    } else {
                        const prevMsg = currentGroup[currentGroup.length - 1];
                        const timeDiff = msg.created_at - prevMsg.created_at;
                        if (timeDiff > THREE_HOURS_SECONDS) {
                            groups.push(currentGroup);
                            currentGroup = [msg];
                        } else {
                            currentGroup.push(msg);
                        }
                    }
                }
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                }

                console.log(`User ${userId}: ${userMsgs.length} messages partitioned into ${groups.length} conversations.`);

                for (const group of groups) {
                    const firstUserMsg = group.find(m => m.role === "user");
                    const rawTitle = firstUserMsg ? firstUserMsg.content.trim() : (group[0] ? group[0].content.trim() : "Geçmiş Sohbet");
                    const title = rawTitle.length > 45 ? rawTitle.substring(0, 45) + "..." : rawTitle;

                    const startTime = group[0].created_at;
                    const endTime = group[group.length - 1].created_at;

                    // Insert conversation
                    const insertConvResult = await runQuery(
                        `INSERT INTO conversations (user_id, title, created_at, updated_at, is_pinned)
                         VALUES (?, ?, ?, ?, 0)`,
                        [userId, title, startTime, endTime]
                    );
                    const newConvId = insertConvResult.lastID;
                    totalConversationsCreated++;

                    // Update group messages
                    const groupIds = group.map(m => m.id);
                    const placeholders = groupIds.map(() => "?").join(",");
                    await runQuery(
                        `UPDATE chat_messages SET conversation_id = ? WHERE id IN (${placeholders})`,
                        [newConvId, ...groupIds]
                    );
                    totalMessagesMigrated += groupIds.length;
                }
            }

            console.log(`✅ Successfully created ${totalConversationsCreated} conversations and migrated ${totalMessagesMigrated} messages.`);
        }

        // 6. Link saved_widgets to corresponding conversation_id via related_message_id
        console.log("Step 6: Linking 'saved_widgets' to 'conversation_id'...");
        await runQuery(`
            UPDATE saved_widgets 
            SET conversation_id = (
                SELECT cm.conversation_id 
                FROM chat_messages cm 
                WHERE cm.id = saved_widgets.related_message_id
            )
            WHERE related_message_id IS NOT NULL AND conversation_id IS NULL;
        `);

        const linkedWidgetsCount = await getQuery("SELECT COUNT(*) as count FROM saved_widgets WHERE conversation_id IS NOT NULL;");
        console.log(`✅ Saved widgets with linked conversation_id: ${linkedWidgetsCount ? linkedWidgetsCount.count : 0}`);

        // 7. Final Verification
        const finalUnassigned = await getQuery("SELECT COUNT(*) as count FROM chat_messages WHERE conversation_id IS NULL;");
        const finalTotal = await getQuery("SELECT COUNT(*) as count FROM chat_messages;");

        console.log("\n=================================================");
        console.log("MIGRATION INTEGRITY REPORT:");
        console.log(`- Messages Before: ${totalMsgs}`);
        console.log(`- Messages After: ${finalTotal.count}`);
        console.log(`- Unassigned Messages Remaining: ${finalUnassigned.count}`);
        console.log("=================================================\n");

        if (finalUnassigned.count === 0 && finalTotal.count === totalMsgs) {
            console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY WITH 100% INTEGRITY!");
        } else {
            console.error("⚠️ Warning: Discrepancy detected during migration integrity check.");
            process.exit(1);
        }

    } catch (err) {
        console.error("❌ Migration failed with error:", err);
        process.exit(1);
    } finally {
        db.close();
    }
}

migrate();
