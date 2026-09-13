/**
 * Unit Test Suite for calculateSensoryFit Tool
 * Tests proportional scoring, fuzzy trait matching, unrecognized tags, guest mode, and error handling.
 */

const assert = require("assert");
const db = require("../db");
const { executeTool } = require("../tools");
const calculateSensoryFit = require("../tools/calculateSensoryFit");

console.log("=================================================");
console.log("🧪 RUNNING calculateSensoryFit UNIT TEST SUITE");
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

async function runSensoryTests() {
    const testUserId = 55555;
    await new Promise(resolve => {
        db.run(
            `INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
            [testUserId, "sensory_test@test.com", "pass123", "SensoryTester"],
            () => resolve()
        );
    });

    // Clean previous triggers
    await new Promise(resolve => {
        db.run(`DELETE FROM user_sensory_triggers WHERE user_id = ?`, [testUserId], () => resolve());
    });

    // 1. Setup triggers for user 55555:
    // Attribute id 3 = 'Mushy Texture' (is_problematic=1)
    // Attribute id 5 = 'Strong Smell' (is_problematic=1)
    await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO user_sensory_triggers (user_id, attribute_id, is_problematic) VALUES (?, 3, 1), (?, 5, 1)`,
            [testUserId, testUserId],
            err => err ? reject(err) : resolve()
        );
    });

    // TEST 1: High fit when tags do not conflict
    await it("1. High fitScore (100) and 'high_fit' when tags do not conflict with user triggers", async () => {
        const res = await executeTool("calculateSensoryFit", {
            foodName: "Fırında Çıtır Havuç",
            estimatedSensoryTags: ["Crunchy Texture", "Bland Taste"]
        }, { userId: testUserId });

        assert.strictEqual(res.status, "success");
        assert.strictEqual(res.fitScore, 100);
        assert.strictEqual(res.recommendation, "high_fit");
        assert.strictEqual(res.conflictingTraits.length, 0);
        assert.strictEqual(res.matchingTraits.length, 2);
    });

    // TEST 2: Proportional scoring when 1 of 2 tags conflicts (50% reduction -> score 50)
    await it("2. Proportional fitScore (50) and 'low_fit' when 1 of 2 tags conflicts ('mushy')", async () => {
        const res = await executeTool("calculateSensoryFit", {
            foodName: "Patates Püresi",
            estimatedSensoryTags: ["mushy", "bland"]
        }, { userId: testUserId });

        assert.strictEqual(res.status, "success");
        assert.strictEqual(res.fitScore, 50); // 100 - (1/2 * 100) = 50
        assert.strictEqual(res.recommendation, "low_fit");
        assert.strictEqual(res.conflictingTraits.length, 1);
        assert.strictEqual(res.conflictingTraits[0].matchedTrigger, "Mushy Texture");
    });

    // TEST 3: Proportional scoring when 1 of 4 tags conflicts (25% reduction -> score 75)
    await it("3. Proportional fitScore (75) and 'moderate_fit' when 1 of 4 tags conflicts", async () => {
        const res = await executeTool("calculateSensoryFit", {
            foodName: "Sebzeli Pilav",
            estimatedSensoryTags: ["Crunchy Texture", "Bland Taste", "Cold Temperature", "mushy"]
        }, { userId: testUserId });

        assert.strictEqual(res.status, "success");
        assert.strictEqual(res.fitScore, 75); // 100 - (1/4 * 100) = 75
        assert.strictEqual(res.recommendation, "moderate_fit");
        assert.strictEqual(res.conflictingTraits.length, 1);
    });

    // TEST 4: Unrecognized tags handling
    await it("4. Captures unrecognizedTags when model provides arbitrary tags", async () => {
        const res = await executeTool("calculateSensoryFit", {
            foodName: "Uzay Yemeği",
            estimatedSensoryTags: ["galaktik", "parlaklikxyz"]
        }, { userId: testUserId });

        assert.strictEqual(res.status, "success");
        assert.strictEqual(res.recommendation, "unrecognized_traits");
        assert.strictEqual(res.unrecognizedTags.length, 2);
        assert.strictEqual(res.fitScore, 70); // Distinct from genuine 100 fit
    });

    // TEST 5: Guest Mode (no userId)
    await it("5. Guest Mode returns neutral_no_profile without error", async () => {
        const res = await executeTool("calculateSensoryFit", {
            foodName: "Elmalı Kek",
            estimatedSensoryTags: ["crunchy", "sweet"]
        }, {});

        assert.strictEqual(res.status, "success");
        assert.strictEqual(res.user_authenticated, false);
        assert.strictEqual(res.recommendation, "neutral_no_profile");
        assert.strictEqual(res.fitScore, 100);
    });

    // TEST 6: Empty input validation
    await it("6. Returns error when estimatedSensoryTags is empty", async () => {
        const res = await executeTool("calculateSensoryFit", {
            foodName: "Elmalı Kek",
            estimatedSensoryTags: []
        }, { userId: testUserId });

        assert.strictEqual(res.status, "error");
        assert.strictEqual(res.error_code, "EMPTY_TAGS");
    });

    console.log("\n=================================================");
    console.log(`Test Summary: ${passed} / ${total} tests passed.`);
    console.log("=================================================\n");

    if (passed !== total) {
        process.exit(1);
    }
}

runSensoryTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
