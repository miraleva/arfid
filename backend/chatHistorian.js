// backend/chatHistorian.js

/**
 * Creates the chat_messages table and necessary indexes.
 */
function initChatSchema(db) {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_id ON chat_messages(user_id, id)`);
        console.log("[Historian] Chat schema initialized.");
    });
}

/**
 * Saves a message to the database and applies retention policy.
 */
async function saveMessage(db, userId, role, content) {
    if (!userId) return;

    const createdAt = Math.floor(Date.now() / 1000); // Unix epoch seconds

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)`,
            [userId, role, content, createdAt],
            async function (err) {
                if (err) {
                    console.error("[Historian] Save message failed:", err.message);
                    return resolve(); // Graceful fallback
                }

                try {
                    await applyRetention(db, userId);
                    resolve(this.lastID);
                } catch (retentionErr) {
                    console.error("[Historian] Retention policy failed:", retentionErr.message);
                    resolve(); // Still success since message was saved
                }
            }
        );
    });
}

/**
 * Retrieves the last N messages for a user, ordered chronologically.
 */
function getRecentMessages(db, userId, limit = 10) {
    return new Promise((resolve, reject) => {
        if (!userId) return resolve([]);

        db.all(
            `SELECT role, content FROM (
                SELECT role, content, id 
                FROM chat_messages 
                WHERE user_id = ? 
                ORDER BY id DESC 
                LIMIT ?
            ) ORDER BY id ASC`,
            [userId, limit],
            (err, rows) => {
                if (err) {
                    console.error("[Historian] Get recent messages failed:", err.message);
                    return resolve([]);
                }
                resolve(rows || []);
            }
        );
    });
}

/**
 * Ensures a user's chat history does not exceed the limit.
 * If > 200 messages, deletes the oldest 50.
 */
async function applyRetention(db, userId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ?`, [userId], (err, row) => {
            if (err) return reject(err);

            if (row && row.count > 200) {
                console.log(`[Historian] Applying retention for User[${userId}]: ${row.count} messages.`);

                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    // Delete oldest 50 by smallest ID
                    db.run(
                        `DELETE FROM chat_messages 
                         WHERE id IN (
                             SELECT id FROM chat_messages 
                             WHERE user_id = ? 
                             ORDER BY id ASC 
                             LIMIT 50
                         )`,
                        [userId],
                        (delErr) => {
                            if (delErr) {
                                db.run("ROLLBACK");
                                return reject(delErr);
                            }
                            db.run("COMMIT", (commitErr) => {
                                if (commitErr) return reject(commitErr);
                                console.log(`[Historian] Pruned 50 messages for User[${userId}].`);
                                resolve();
                            });
                        }
                    );
                });
            } else {
                resolve();
            }
        });
    });
}

module.exports = {
    initChatSchema,
    saveMessage,
    getRecentMessages,
    applyRetention
};
