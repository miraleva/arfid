/**
 * Unit Tests for widgetRepository
 * Tests saving, duplicate protection within 5m, user isolation, message linking, and deletion.
 */

const assert = require("assert");
const widgetRepository = require("../repositories/widgetRepository");

console.log("=================================================");
console.log("🧪 RUNNING WIDGET REPOSITORY UNIT TEST SUITE");
console.log("=================================================\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
    total++;
    try {
        const res = fn();
        if (res instanceof Promise) {
            return res
                .then(() => {
                    console.log(`✅ [PASS] ${desc}`);
                    passed++;
                })
                .catch(err => {
                    console.error(`❌ [FAIL] ${desc}`);
                    console.error("  Error:", err.message);
                });
        } else {
            console.log(`✅ [PASS] ${desc}`);
            passed++;
        }
    } catch (err) {
        console.error(`❌ [FAIL] ${desc}`);
        console.error("  Error:", err.message);
    }
}

async function runTests() {
    const db = require("../db");
    const testUserId = 999991;
    const testUserId2 = 999992;
    let testMessageId = null;

    // Setup: Insert test users and chat message
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
                [testUserId, "widget_test_1@test.com", "pass", "WidgetUser1"]);
            db.run(`INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
                [testUserId2, "widget_test_2@test.com", "pass", "WidgetUser2"]);
            db.run(`DELETE FROM saved_widgets WHERE user_id IN (?, ?)`, [testUserId, testUserId2]);
            db.run(`DELETE FROM chat_messages WHERE user_id IN (?, ?)`, [testUserId, testUserId2]);
            db.run(`INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)`,
                [testUserId, "assistant", "Burada bir tarif var", Math.floor(Date.now() / 1000)],
                function (err) {
                    if (err) return reject(err);
                    testMessageId = this.lastID;
                    resolve();
                }
            );
        });
    });

    const recipePayload = {
        type: "recipe",
        title: "Test Çıtır Patates",
        data: {
            servings: "2 Kişilik",
            calories_approx: 220,
            ingredients: [{ name: "Patates", amount: 2, unit: "adet" }]
        }
    };

    // TEST 1: Save widget
    let savedWidgetId = null;
    await it("1. widgetRepository.saveWidget saves a new widget", async () => {
        const res = await widgetRepository.saveWidget(
            testUserId,
            "recipe",
            "Test Çıtır Patates",
            recipePayload,
            testMessageId
        );
        assert.ok(res, "Result should not be null");
        assert.ok(res.id > 0, "Should have valid database id");
        assert.strictEqual(res.title, "Test Çıtır Patates");
        assert.strictEqual(res.relatedMessageId, testMessageId);
        savedWidgetId = res.id;
    });

    // TEST 2: Duplicate check within 5 minutes
    await it("2. widgetRepository.saveWidget rejects duplicate title/type within 5 minutes", async () => {
        const dupRes = await widgetRepository.saveWidget(
            testUserId,
            "recipe",
            "Test Çıtır Patates", // Same title
            recipePayload,
            124
        );
        assert.strictEqual(dupRes, null, "Duplicate save within 5m must return null");
    });

    // TEST 3: Allows same title for DIFFERENT user
    await it("3. widgetRepository.saveWidget allows same title for a different user", async () => {
        const diffUserRes = await widgetRepository.saveWidget(
            999992,
            "recipe",
            "Test Çıtır Patates",
            recipePayload
        );
        assert.ok(diffUserRes, "Different user should succeed");
        assert.ok(diffUserRes.id > 0);
        // Clean up
        await widgetRepository.deleteWidget(diffUserRes.id, 999992);
    });

    // TEST 4: getUserWidgets fetches parsed widgets
    await it("4. widgetRepository.getUserWidgets returns list with parsed widget_data", async () => {
        const widgets = await widgetRepository.getUserWidgets(testUserId);
        assert.ok(Array.isArray(widgets));
        const found = widgets.find(w => w.id === savedWidgetId);
        assert.ok(found, "Saved widget should be in list");
        assert.strictEqual(typeof found.widget_data, "object");
        assert.strictEqual(found.widget_data.data.servings, "2 Kişilik");
    });

    // TEST 5: getWidgetById
    await it("5. widgetRepository.getWidgetById retrieves exact widget", async () => {
        const widget = await widgetRepository.getWidgetById(savedWidgetId, testUserId);
        assert.ok(widget);
        assert.strictEqual(widget.id, savedWidgetId);
        assert.strictEqual(widget.title, "Test Çıtır Patates");
    });

    // TEST 6: updateRelatedMessageId
    await it("6. widgetRepository.updateRelatedMessageId updates linkage", async () => {
        let msgId2 = null;
        await new Promise((res, rej) => {
            db.run(`INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)`,
                [testUserId, "assistant", "İkinci mesaj", Math.floor(Date.now() / 1000)],
                function (err) {
                    if (err) return rej(err);
                    msgId2 = this.lastID;
                    res();
                }
            );
        });

        const updated = await widgetRepository.updateRelatedMessageId(savedWidgetId, msgId2, testUserId);
        assert.strictEqual(updated, true);
        const widget = await widgetRepository.getWidgetById(savedWidgetId, testUserId);
        assert.strictEqual(widget.related_message_id, msgId2);
    });

    // TEST 7: deleteWidget
    await it("7. widgetRepository.deleteWidget deletes the widget", async () => {
        const deleted = await widgetRepository.deleteWidget(savedWidgetId, testUserId);
        assert.strictEqual(deleted, true);
        const widget = await widgetRepository.getWidgetById(savedWidgetId, testUserId);
        assert.strictEqual(widget, null);
    });

    console.log("\n=================================================");
    console.log(`Test Summary: ${passed} / ${total} tests passed.`);
    console.log("=================================================\n");

    if (passed !== total) {
        process.exit(1);
    }
}

runTests();
