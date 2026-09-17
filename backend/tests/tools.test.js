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
    it("1. Tool registry exposes calculateCalories, calculateSensoryFit, and presentAsWidget with valid schemas", () => {
        assert.strictEqual(functionDeclarations.length, 3);
        const names = functionDeclarations.map(t => t.name);
        assert.ok(names.includes("calculateCalories"));
        assert.ok(names.includes("calculateSensoryFit"));
        assert.ok(names.includes("presentAsWidget"));
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

    // TEST 6: presentAsWidget formats recipe widget with approximate calories
    await it("6. presentAsWidget formats recipe widget and sets is_verified_calories to false", async () => {
        const recipeRes = await executeTool("presentAsWidget", {
            widget_type: "recipe",
            title: "Fırında Çıtır Patates",
            recipe_data: {
                display_mode: "single",
                prep_time_min: 10,
                cook_time_min: 25,
                servings: "2 Kişilik",
                calories_approx: 220,
                sensory_tags: ["Çıtır", "Kuru Doku"],
                ingredients: [{ name: "Patates", amount: 2, unit: "adet" }],
                instructions: ["Dilimle", "Fırınla"]
            }
        });
        assert.strictEqual(recipeRes.status, "success");
        assert.strictEqual(recipeRes.widget.type, "recipe");
        assert.strictEqual(recipeRes.widget.data.is_verified_calories, false);
        assert.strictEqual(recipeRes.widget.data.calories_approx, 220);
    });

    // TEST 7: presentAsWidget formats nutrition widget with verified calories
    await it("7. presentAsWidget formats nutrition widget and sets is_verified to true", async () => {
        const nutritionRes = await executeTool("presentAsWidget", {
            widget_type: "nutrition",
            title: "Tavuk Göğsü Besin Değeri",
            nutrition_data: {
                food_name: "Tavuk Göğsü",
                amount_label: "150 gram",
                total_calories: 247,
                macros: { protein_g: 46.5, carbs_g: 0, fat_g: 5.4 }
            }
        });
        assert.strictEqual(nutritionRes.status, "success");
        assert.strictEqual(nutritionRes.widget.type, "nutrition");
        assert.strictEqual(nutritionRes.widget.data.is_verified, true);
        assert.strictEqual(nutritionRes.widget.data.total_calories, 247);
    });

    // TEST 8: presentAsWidget catches invalid widget type or missing title
    await it("8. presentAsWidget validates required fields and types", async () => {
        const invalidTypeRes = await executeTool("presentAsWidget", {
            widget_type: "unknown_type",
            title: "Test"
        });
        assert.strictEqual(invalidTypeRes.status, "error");
        assert.strictEqual(invalidTypeRes.error_code, "INVALID_WIDGET_TYPE");

        const missingTitleRes = await executeTool("presentAsWidget", {
            widget_type: "recipe"
        });
        assert.strictEqual(missingTitleRes.status, "error");
        assert.strictEqual(missingTitleRes.error_code, "MISSING_TITLE");
    });

    console.log("\n=================================================");
    console.log(`Test Summary: ${passed} / ${total} tests passed.`);
    console.log("=================================================\n");

    if (passed !== total) {
        process.exit(1);
    }
}

runTests();
