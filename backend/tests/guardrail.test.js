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

console.log("\n=================================================");
console.log(`Test Summary: ${passed} / ${total} tests passed.`);
console.log("=================================================\n");

if (passed !== total) {
    process.exit(1);
}
