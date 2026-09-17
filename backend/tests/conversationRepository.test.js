/**
 * Unit Tests for conversation lifecycle in chatRepository & database
 */

const assert = require("assert");
const db = require("../db");
const chatRepository = require("../repositories/chatRepository");
const widgetRepository = require("../repositories/widgetRepository");

console.log("=================================================");
console.log("🧪 RUNNING CONVERSATION REPOSITORY UNIT TEST SUITE");
console.log("=================================================\n");

let passed = 0;
let total = 0;

async function test(desc, fn) {
    total++;
    try {
        await fn();
        console.log(`✅ [PASS] ${desc}`);
        passed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${desc}`);
        console.error("  Error:", err.message);
    }
}

async function runTests() {
    const testUserId = 888881;
    const otherUserId = 888882;

    // Setup: clean and prepare test users
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
                [testUserId, "conv_test_1@test.com", "pass", "ConvUser1"]);
            db.run(`INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
                [otherUserId, "conv_test_2@test.com", "pass", "ConvUser2"]);
            db.run(`DELETE FROM chat_messages WHERE user_id IN (?, ?)`, [testUserId, otherUserId]);
            db.run(`DELETE FROM saved_widgets WHERE user_id IN (?, ?)`, [testUserId, otherUserId]);
            db.run(`DELETE FROM conversations WHERE user_id IN (?, ?)`, [testUserId, otherUserId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    });

    let conv1 = null;
    let conv2 = null;

    await test("1. createConversation creates a new session with title and timestamps", async () => {
        conv1 = await chatRepository.createConversation(testUserId, "İlk Sohbetim");
        assert.ok(conv1 && conv1.id, "Conversation should have an id");
        assert.strictEqual(conv1.title, "İlk Sohbetim");
        assert.strictEqual(conv1.user_id, testUserId);
        assert.strictEqual(conv1.is_pinned, 0);
    });

    await test("2. saveMessage attaches messages to conversation_id", async () => {
        const msgId1 = await chatRepository.saveMessage(testUserId, conv1.id, 'user', 'Merhaba diyetisyen!');
        const msgId2 = await chatRepository.saveMessage(testUserId, conv1.id, 'assistant', 'Merhaba! Nasıl yardımcı olabilirim?');
        assert.ok(msgId1 > 0);
        assert.ok(msgId2 > msgId1);

        const messages = await chatRepository.getConversationMessages(conv1.id, testUserId);
        assert.strictEqual(messages.length, 2);
        assert.strictEqual(messages[0].content, 'Merhaba diyetisyen!');
        assert.strictEqual(messages[1].content, 'Merhaba! Nasıl yardımcı olabilirim?');
    });

    await test("3. Context isolation: getRecentMessages only fetches messages for the active conversation", async () => {
        // Create second conversation for same user
        conv2 = await chatRepository.createConversation(testUserId, "İkinci Sohbetim");
        await chatRepository.saveMessage(testUserId, conv2.id, 'user', 'Yulaf ezmesi tarifi var mı?');

        const contextConv1 = await chatRepository.getRecentMessages(conv1.id, 10);
        assert.strictEqual(contextConv1.length, 2);
        assert.ok(!contextConv1.some(m => m.content.includes('Yulaf')));

        const contextConv2 = await chatRepository.getRecentMessages(conv2.id, 10);
        assert.strictEqual(contextConv2.length, 1);
        assert.ok(contextConv2[0].content.includes('Yulaf'));
    });

    await test("4. getUserConversations returns sorted list with user isolation", async () => {
        // Create a conversation for other user
        await chatRepository.createConversation(otherUserId, "Başka Kullanıcı Sohbeti");

        const userConvs = await chatRepository.getUserConversations(testUserId);
        assert.strictEqual(userConvs.length, 2);
        assert.ok(userConvs.every(c => c.user_id === testUserId));
    });

    await test("5. togglePinConversation toggles is_pinned and affects sorting order", async () => {
        // Pin conv1
        const pinnedSuccess = await chatRepository.togglePinConversation(conv1.id, testUserId);
        assert.strictEqual(pinnedSuccess, true);

        let userConvs = await chatRepository.getUserConversations(testUserId);
        assert.strictEqual(userConvs[0].id, conv1.id);
        assert.strictEqual(userConvs[0].is_pinned, 1);

        // Unpin conv1
        await chatRepository.togglePinConversation(conv1.id, testUserId);
        userConvs = await chatRepository.getUserConversations(testUserId);
        const conv1Found = userConvs.find(c => c.id === conv1.id);
        assert.strictEqual(conv1Found.is_pinned, 0);
    });

    await test("6. renameConversation modifies title successfully", async () => {
        const renamed = await chatRepository.renameConversation(conv1.id, testUserId, "Yeni ARFID Planı");
        assert.strictEqual(renamed, true);

        const convs = await chatRepository.getUserConversations(testUserId);
        const updated = convs.find(c => c.id === conv1.id);
        assert.strictEqual(updated.title, "Yeni ARFID Planı");
    });

    await test("7. deleteConversation deletes session, cascades messages, and preserves saved widgets (SET NULL)", async () => {
        // Save a widget linked to conv2
        const widget = await widgetRepository.saveWidget(
            testUserId,
            "recipe",
            "Yulaf Lapası",
            { prep_time_min: 5 },
            null,
            conv2.id
        );
        assert.ok(widget && widget.id);

        // Delete conv2
        const deleted = await chatRepository.deleteConversation(conv2.id, testUserId);
        assert.strictEqual(deleted, true);

        // Verify conversation is gone
        const convsAfter = await chatRepository.getUserConversations(testUserId);
        assert.ok(!convsAfter.some(c => c.id === conv2.id));

        // Verify messages in conv2 are gone (CASCADE)
        const messagesAfter = await chatRepository.getConversationMessages(conv2.id, testUserId);
        assert.strictEqual(messagesAfter.length, 0);

        // Verify widget is preserved with conversation_id = null (SET NULL)
        const savedWidget = await widgetRepository.getWidgetById(widget.id, testUserId);
        assert.ok(savedWidget, "Widget should still exist in saved_widgets");
        assert.strictEqual(savedWidget.conversation_id, null, "conversation_id should be SET NULL");
    });

    await test("8. getConversationMessages restores widget when related_message_id is present", async () => {
        const msgId = await chatRepository.saveMessage(testUserId, conv1.id, 'assistant', 'İşte tarifiniz:');
        const widget = await widgetRepository.saveWidget(
            testUserId,
            "recipe",
            "Kıtır Ekmek",
            { prep_time_min: 10 },
            msgId,
            conv1.id
        );
        assert.ok(widget && widget.id);

        const messages = await chatRepository.getConversationMessages(conv1.id, testUserId);
        const targetMsg = messages.find(m => m.id === msgId);
        assert.ok(targetMsg, "Message should be found");
        assert.ok(targetMsg.widget, "Message should have attached widget");
        assert.strictEqual(targetMsg.widget.title, "Kıtır Ekmek");
        assert.strictEqual(targetMsg.widget.data.prep_time_min, 10);
    });

    await test("9. Deduplication check: Multiple widgets on SAME related_message_id do NOT duplicate message rows", async () => {
        const dedupMsgId = await chatRepository.saveMessage(testUserId, conv1.id, 'assistant', 'Çoklu widget test mesajı');
        
        // Insert 3 widgets pointing to the exact same related_message_id
        await widgetRepository.saveWidget(testUserId, "recipe", "Widget 1", { step: 1 }, dedupMsgId, conv1.id);
        await widgetRepository.saveWidget(testUserId, "recipe", "Widget 2", { step: 2 }, dedupMsgId, conv1.id);
        await widgetRepository.saveWidget(testUserId, "recipe", "Widget 3 (Son)", { step: 3 }, dedupMsgId, conv1.id);

        const messages = await chatRepository.getConversationMessages(conv1.id, testUserId);
        const matchingMessages = messages.filter(m => m.id === dedupMsgId);
        
        // CRITICAL CHECK: Exactly 1 row must be returned!
        assert.strictEqual(matchingMessages.length, 1, `Expected exactly 1 message row, but got ${matchingMessages.length} (Row duplication occurred!)`);
        assert.ok(matchingMessages[0].widget, "Widget should be present on the deduplicated row");
        // Because MAX(id) was used, it should pick the latest widget
        assert.strictEqual(matchingMessages[0].widget.title, "Widget 3 (Son)");
    });

    // Cleanup
    await new Promise((resolve) => {
        db.serialize(() => {
            db.run(`DELETE FROM chat_messages WHERE user_id IN (?, ?)`, [testUserId, otherUserId]);
            db.run(`DELETE FROM saved_widgets WHERE user_id IN (?, ?)`, [testUserId, otherUserId]);
            db.run(`DELETE FROM conversations WHERE user_id IN (?, ?)`, [testUserId, otherUserId], resolve);
        });
    });

    console.log(`\n=================================================`);
    console.log(`📊 RESULTS: ${passed}/${total} tests passed`);
    console.log(`=================================================`);

    if (passed === total) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Fatal test suite error:", err);
    process.exit(1);
});
