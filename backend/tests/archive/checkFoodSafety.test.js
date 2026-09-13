/**
 * Tool Registry & Calorie Calculation Unit Tests
 * Verifies calculateCalories execution, unmatched food reporting, and Tool Registry error handling.
 */

const assert = require("assert");
const calculateCalories = require("../tools/calculateCalories");
const { executeTool, functionDeclarations } = require("../tools");

console.log("=================================================");
console.log("🧪 RUNNING TOOLS & FUNCTION CALLING UNIT TEST SUITE");
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
    // TEST 1: Tool registry declaration integrity
    it("1. Tool registry exposes calculateCalories and checkFoodSafety with valid schemas", () => {
        assert.strictEqual(functionDeclarations.length, 2);
        const toolNames = functionDeclarations.map(t => t.name);
        assert.ok(toolNames.includes("calculateCalories"));
        assert.ok(toolNames.includes("checkFoodSafety"));
    });

    // TEST 2: Valid calorie calculation execution
    await it("2. calculateCalories successfully calculates total and itemized calories", async () => {
        const calcRes = await calculateCalories.execute({
            ingredients: [
                { name: "muz", amount: 1, unit: "adet" },
                { name: "yulaf ezmesi", amount: 50, unit: "gram" },
                { name: "süt", amount: 200, unit: "ml" }
            ]
        });
        assert.strictEqual(calcRes.status, "success");
        assert.ok(calcRes.total_calories > 0, `Total calories should be positive (${calcRes.total_calories})`);
        assert.strictEqual(calcRes.items.length, 3);
        assert.strictEqual(calcRes.unmatched.length, 0);
    });

    // TEST 3: Unmatched ingredient detection
    await it("3. calculateCalories detects and reports unmatched ingredient without hallucinating", async () => {
        const unmatchRes = await calculateCalories.execute({
            ingredients: [
                { name: "ejder meyvesi pitaya", amount: 100, unit: "gram" },
                { name: "elma", amount: 1, unit: "adet" }
            ]
        });
        assert.strictEqual(unmatchRes.status, "success");
        assert.strictEqual(unmatchRes.unmatched.length, 1);
        assert.strictEqual(unmatchRes.unmatched[0].requested_name, "ejder meyvesi pitaya");
        assert.strictEqual(unmatchRes.items.length, 1);
    });

    // TEST 4: Registry error handling for unknown tool
    await it("4. executeTool safely catches non-existent tool calls", async () => {
        const invalidToolRes = await executeTool("nonExistentTool", { foo: "bar" });
        assert.strictEqual(invalidToolRes.status, "error");
        assert.strictEqual(invalidToolRes.error_code, "TOOL_NOT_FOUND");
    });

    // TEST 5: Registry error handling for malformed/null arguments
    await it("5. executeTool safely catches null or malformed tool arguments", async () => {
        const malformedRes = await executeTool("calculateCalories", null);
        assert.strictEqual(malformedRes.status, "error");
        assert.strictEqual(malformedRes.error_code, "INVALID_ARGUMENTS");
    });

    // TEST 6: checkFoodSafety guest mode (no userId)
    await it("6. checkFoodSafety handles guest mode gracefully without crashing", async () => {
        const guestRes = await executeTool("checkFoodSafety", { foodNames: ["tavuk", "mantar"] }, {});
        assert.strictEqual(guestRes.status, "success");
        assert.strictEqual(guestRes.user_authenticated, false);
        assert.strictEqual(guestRes.checked_items.length, 2);
        assert.strictEqual(guestRes.checked_items[0].status, "unknown");
        assert.strictEqual(guestRes.checked_items[0].reason, "GUEST_MODE_NO_USER");
    });

    // TEST 7: checkFoodSafety empty input validation
    await it("7. checkFoodSafety returns error when foodNames array is empty", async () => {
        const emptyRes = await executeTool("checkFoodSafety", { foodNames: [] }, { userId: 1 });
        assert.strictEqual(emptyRes.status, "error");
    });

    // Setup mock or test user preferences for checkFoodSafety safe/unsafe/fuzzy tests
    const db = require("../db");
    const { ensureMasterRecord } = require("../repositories/memoryRepository");
    const testUserId = 88888;
    await new Promise((resolve) => {
        db.run(
            `INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
            [testUserId, "safety_test@test.com", "pass123", "SafetyTester"],
            () => resolve()
        );
    });
    
    const chickenId = await ensureMasterRecord("foods", "chicken", "chicken");
    const mushroomId = await ensureMasterRecord("foods", "mushroom", "mushroom");

    await new Promise((resolve) => {
        db.run(`DELETE FROM user_food_preferences WHERE user_id = ?`, [testUserId], () => resolve());
    });
    // chickenId is safe (1), mushroomId is unsafe (0)
    await new Promise((resolve, reject) => {
        db.run(`INSERT INTO user_food_preferences (user_id, food_id, is_safe) VALUES (?, ?, 1), (?, ?, 0)`,
            [testUserId, chickenId, testUserId, mushroomId], (err) => err ? reject(err) : resolve());
    });

    // TEST 8: checkFoodSafety identifies safe and unsafe foods accurately
    await it("8. checkFoodSafety identifies safe and unsafe foods correctly", async () => {
        const safetyRes = await executeTool("checkFoodSafety", { foodNames: ["chicken", "mushroom", "brokoli"] }, { userId: testUserId });
        assert.strictEqual(safetyRes.status, "success");
        assert.strictEqual(safetyRes.checked_items.length, 3);
        
        const chickenCheck = safetyRes.checked_items.find(i => i.requested_name === "chicken");
        const mushroomCheck = safetyRes.checked_items.find(i => i.requested_name === "mushroom");
        const brokoliCheck = safetyRes.checked_items.find(i => i.requested_name === "brokoli");

        assert.strictEqual(chickenCheck.status, "safe");
        assert.strictEqual(mushroomCheck.status, "unsafe");
        assert.strictEqual(brokoliCheck.status, "unknown");
    });

    // TEST 9: checkFoodSafety fuzzy matches Turkish aliases and typos
    await it("9. checkFoodSafety fuzzy matches food names with typos or Turkish terms", async () => {
        // 'mushrom' typo -> mushroom (unsafe), 'chiken' typo -> chicken (safe)
        const fuzzyRes = await executeTool("checkFoodSafety", { foodNames: ["mushrom"] }, { userId: testUserId });
        assert.strictEqual(fuzzyRes.status, "success");
        assert.strictEqual(fuzzyRes.checked_items.length, 1);
        assert.strictEqual(fuzzyRes.checked_items[0].status, "unsafe");
        assert.strictEqual(fuzzyRes.checked_items[0].matched_name, "mushroom");
    });

    console.log("\n=================================================");
    console.log(`Test Summary: ${passed} / ${total} tests passed.`);
    console.log("=================================================\n");

    if (passed !== total) {
        process.exit(1);
    }
}

runTests();
