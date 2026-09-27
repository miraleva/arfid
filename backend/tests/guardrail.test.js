/**
 * Dietary Guardrail Unit Tests (Deterministic / No LLM dependency)
 * Verifies Layer 3 output validation and Turkish suffix handling (somon -> somonlu/somondan).
 */

const assert = require("assert");
const { validateDietaryOutput, createSafetyFallbackResponse } = require("../guardrails/dietaryGuardrail");

console.log("=================================================");
console.log("🧪 RUNNING DIETARY GUARDRAIL UNIT TEST SUITE");
console.log("=================================================\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
    total++;
    try {
        fn();
        console.log(`✅ [PASS] ${desc}`);
        passed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${desc}`);
        console.error("  Error:", err.message);
    }
}

const mockAvoidFoods = ["somon", "mantar", "patlican", "kirmizi et"];

// TEST 1: Safe clean response
it("1. Clean message with no avoid foods should pass", () => {
    const text = "Size pürüzsüz kıvamda ılık bir tavuk çorbası öneriyorum. Yanında çıtır haşlanmış patates tüketebilirsiniz.";
    const result = validateDietaryOutput(text, mockAvoidFoods);
    assert.strictEqual(result.isSafe, true);
    assert.strictEqual(result.blockedFoods.length, 0);
});

// TEST 2: Exact single word avoid food breach
it("2. Exact avoid food breach ('somon') should be blocked", () => {
    const text = "Akşam yemeğinde ızgara somon ve yanında pirinç pilavı tercih edebilirsiniz.";
    const result = validateDietaryOutput(text, mockAvoidFoods);
    assert.strictEqual(result.isSafe, false);
    assert.deepStrictEqual(result.blockedFoods, ["somon"]);
});

// TEST 3: Turkish suffix breach ('somonlu', 'mantardan')
it("3. Turkish suffixed avoid food ('somonlu', 'mantardan') should be blocked", () => {
    const text = "Fırında lezzetli bir somonlu makarna yapabilir veya mantardan çorba hazırlayabilirsiniz.";
    const result = validateDietaryOutput(text, mockAvoidFoods);
    assert.strictEqual(result.isSafe, false);
    assert.ok(result.blockedFoods.includes("somon"));
    assert.ok(result.blockedFoods.includes("mantar"));
});

// TEST 4: Multi-word avoid food breach ('kirmizi et')
it("4. Multi-word avoid food ('kırmızı et') should be blocked with Turkish normalization", () => {
    const text = "Demir eksikliğiniz için haftada bir kırmızı et tüketmeyi deneyebilirsiniz.";
    const result = validateDietaryOutput(text, mockAvoidFoods);
    assert.strictEqual(result.isSafe, false);
    assert.ok(result.blockedFoods.includes("kirmizi et"));
});

// TEST 5: Short root false-positive prevention ('et' shouldn't block 'etkili' or 'tercih etmek')
it("5. Short root avoid food should not false-positive on unrelated words", () => {
    const shortList = ["et"];
    const text = "Bu tarif beslenmenizi etkili şekilde destekler, tüketmeyi tercih edebilirsiniz.";
    const result = validateDietaryOutput(text, shortList);
    assert.strictEqual(result.isSafe, true);
});

// TEST 6: Generic safety fallback response generation
it("6. createSafetyFallbackResponse should produce an empathetic, medical guardrail notice", () => {
    const fallback = createSafetyFallbackResponse(["somon"]);
    assert.ok(fallback.includes("Güvenlik Uyarısı"));
    assert.ok(fallback.includes("somon"));
    assert.ok(fallback.includes("ARFID kısıtlamalarınıza uygun farklı ve güvenli bir tarif"));
});

// TEST 7: Empty or guest mode parameters should handle gracefully without crashing
it("7. Empty inputs should safely return isSafe: true", () => {
    const r1 = validateDietaryOutput("", mockAvoidFoods);
    assert.strictEqual(r1.isSafe, true);
    const r2 = validateDietaryOutput("Herhangi bir mesaj", []);
    assert.strictEqual(r2.isSafe, true);
});

// TEST 8: Soft Mode - Informational query (isRecipeRecommendation: false)
it("8. Informational calorie query in Soft Mode should pass with isSafe: true and warning notice", () => {
    const text = "1 adet orta boy elma yaklaşık 95 kaloridir ve 19g karbonhidrat içerir.";
    const result = validateDietaryOutput(text, ["apple", "elma"], { isRecipeRecommendation: false });
    assert.strictEqual(result.isSafe, true, "Soft mode must not block informational answers");
    assert.ok(result.blockedFoods.includes("apple") || result.blockedFoods.includes("elma"));
    assert.ok(result.warningNotice, "Soft mode must provide a warning notice");
    assert.ok(result.warningNotice.includes("kişisel kaçındığınız gıdalar listenizde yer almaktadır"));
});

// TEST 9: Hard Mode - Recipe recommendation (isRecipeRecommendation: true)
it("9. Recipe suggestion in Hard Mode should be strictly blocked with isSafe: false", () => {
    const text = "Akşam için fırında elmalı tarçınlı bir tatlı hazırlayabilirsin.";
    const result = validateDietaryOutput(text, ["apple", "elma"], { isRecipeRecommendation: true });
    assert.strictEqual(result.isSafe, false, "Hard mode must block recipe recommendations");
    assert.ok(result.blockedFoods.length > 0);
});

// TEST 10: Fail-Safe Rule - No tools called (pure text) defaults to Hard Mode
it("10. Pure text responses without tools must default to Hard Mode (Fail-Safe rule)", () => {
    const text = "Bugün mantarlı bir makarna yapıp tüketebilirsiniz.";
    const result = validateDietaryOutput(text, mockAvoidFoods); // default options
    assert.strictEqual(result.isSafe, false, "Default must be Hard Mode to catch pure-text recipes");
    assert.ok(result.blockedFoods.includes("mantar"));
});

// TEST 11: Tool Rule - Informational tools activate Soft Mode, Recipe tools activate Hard Mode
it("11. Informational tools (calculateCalories) trigger Soft Mode, recipe widgets trigger Hard Mode", () => {
    const avoidFoods = ["apple", "elma"];
    const calorieText = "Elmanın kalorisi 95 kcal'dir.";

    // Scenario A: Only calculateCalories tool was called
    const infoTools = [{ toolName: "calculateCalories", args: {}, output: { status: "success" } }];
    const hasRecipeWidgetA = false;
    const hasRecipeToolCallA = infoTools.some(t => t.toolName === "presentAsWidget" && t.args?.type === "recipe");
    const isInfoOnlyA = infoTools.length > 0 && infoTools.every(t => t.toolName === "calculateCalories" || t.toolName === "calculateSensoryFit");
    const isRecipeRecA = !isInfoOnlyA || hasRecipeWidgetA || hasRecipeToolCallA;

    assert.strictEqual(isRecipeRecA, false, "calculateCalories must evaluate to isRecipeRecommendation: false");
    const resA = validateDietaryOutput(calorieText, avoidFoods, { isRecipeRecommendation: isRecipeRecA });
    assert.strictEqual(resA.isSafe, true);
    assert.ok(resA.warningNotice);

    // Scenario B: Recipe widget was called
    const recipeTools = [
        { toolName: "calculateCalories", args: {}, output: { status: "success" } },
        { toolName: "presentAsWidget", args: { type: "recipe" }, output: { status: "success", widget: { type: "recipe" } } }
    ];
    const hasRecipeWidgetB = true;
    const hasRecipeToolCallB = recipeTools.some(t => t.toolName === "presentAsWidget" && t.args?.type === "recipe");
    const isInfoOnlyB = recipeTools.length > 0 && recipeTools.every(t => t.toolName === "calculateCalories" || t.toolName === "calculateSensoryFit");
    const isRecipeRecB = !isInfoOnlyB || hasRecipeWidgetB || hasRecipeToolCallB;

    assert.strictEqual(isRecipeRecB, true, "recipe widget must evaluate to isRecipeRecommendation: true");
    const resB = validateDietaryOutput("Elmalı kek tarifi:", avoidFoods, { isRecipeRecommendation: isRecipeRecB });
    assert.strictEqual(resB.isSafe, false);
});

console.log("\n=================================================");
console.log(`Test Summary: ${passed} / ${total} tests passed.`);
console.log("=================================================\n");

if (passed !== total) {
    process.exit(1);
}
