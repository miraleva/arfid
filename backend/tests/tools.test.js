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
    it("1. Tool registry exposes calculateCalories and calculateSensoryFit with valid schemas", () => {
        assert.strictEqual(functionDeclarations.length, 2);
        const names = functionDeclarations.map(t => t.name);
        assert.ok(names.includes("calculateCalories"));
        assert.ok(names.includes("calculateSensoryFit"));
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

    console.log("\n=================================================");
    console.log(`Test Summary: ${passed} / ${total} tests passed.`);
    console.log("=================================================\n");

    if (passed !== total) {
        process.exit(1);
    }
}

runTests();
