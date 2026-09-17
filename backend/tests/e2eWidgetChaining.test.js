/**
 * E2E Live Gemini Test: Widget Tool & Sequential Chaining Test
 * Verifies that real Gemini calls can chain:
 * 1. Sequential Chaining: calculateCalories -> presentAsWidget (nutrition card)
 * 2. Direct Recipe Presentation: presentAsWidget (recipe card)
 * 3. Normal conversation: NO widget tool invoked
 */

require("dotenv").config();
const assert = require("assert");
const { getDietitianResponse } = require("../services/dietitianService");

console.log("=================================================");
console.log("🧪 RUNNING E2E REAL GEMINI WIDGET CHAINING TEST");
console.log("=================================================\n");

async function runLiveTests() {
    const testUserId = 88888; // Test user ID

    // TEST 1: Sequential Chaining (Calorie calculation -> Nutrition Widget)
    console.log("--- TEST 1: Sequential Chaining (calculateCalories -> presentAsWidget) ---");
    console.log("Sending: '150 gr tavuk göğsü kaç kalori? Kart olarak sunar mısın?'");
    
    const nutritionRes = await getDietitianResponse(
        "150 gr tavuk göğsü kaç kalori? Kart olarak sunar mısın?",
        testUserId
    );

    console.log("Response text summary:", nutritionRes.assistant_response.substring(0, 120) + "...");
    console.log("Widget captured?:", nutritionRes.widget ? "YES" : "NO");

    if (nutritionRes.widget) {
        console.log("Widget Type:", nutritionRes.widget.type);
        console.log("Widget Title:", nutritionRes.widget.title);
        console.log("Widget Data:", JSON.stringify(nutritionRes.widget.data, null, 2));
    }

    assert.ok(nutritionRes.widget, "Test 1 FAILED: Nutrition query must produce a widget!");
    assert.strictEqual(nutritionRes.widget.type, "nutrition");
    assert.strictEqual(nutritionRes.widget.data.is_verified, true, "Nutrition widget must be marked as verified");
    assert.ok(nutritionRes.widget.data.total_calories > 0, "Nutrition widget must have positive total calories");
    console.log("✅ [PASS] Test 1: Sequential Chaining successfully produced verified nutrition widget!\n");

    console.log("Waiting 35s to respect Gemini API rate limit...");
    await new Promise(r => setTimeout(r, 35000));

    // TEST 2: Direct Recipe Presentation
    console.log("--- TEST 2: Direct Recipe Generation (presentAsWidget: recipe) ---");
    console.log("Sending: 'Bana çıtır bir fırında patates tarifi önerir misin?'");

    const recipeRes = await getDietitianResponse(
        "Bana çıtır bir fırında patates tarifi önerir misin?",
        testUserId
    );

    console.log("Response text summary:", recipeRes.assistant_response.substring(0, 120) + "...");
    console.log("Widget captured?:", recipeRes.widget ? "YES" : "NO");

    if (recipeRes.widget) {
        console.log("Widget Type:", recipeRes.widget.type);
        console.log("Widget Title:", recipeRes.widget.title);
        console.log("Ingredients count:", (recipeRes.widget.data.ingredients || []).length);
        console.log("Instructions count:", (recipeRes.widget.data.instructions || []).length);
        console.log("Is verified calories?:", recipeRes.widget.data.is_verified_calories);
    }

    assert.ok(recipeRes.widget, "Test 2 FAILED: Recipe request must produce a widget!");
    assert.strictEqual(recipeRes.widget.type, "recipe");
    assert.strictEqual(recipeRes.widget.data.is_verified_calories, false, "Recipe calories must be marked as approximate (false)");
    assert.ok(recipeRes.widget.data.ingredients.length > 0, "Recipe must contain ingredients");
    console.log("✅ [PASS] Test 2: Recipe query successfully produced recipe widget!\n");

    console.log("Waiting 35s to respect Gemini API rate limit...");
    await new Promise(r => setTimeout(r, 35000));

    // TEST 3: Normal Conversation (No Widget)
    console.log("--- TEST 3: Normal Conversation (No Widget should be triggered) ---");
    console.log("Sending: 'Merhaba, bugün nasılsın?'");

    const normalRes = await getDietitianResponse(
        "Merhaba, bugün nasılsın?",
        testUserId
    );

    console.log("Response text summary:", normalRes.assistant_response.substring(0, 120) + "...");
    console.log("Widget captured?:", normalRes.widget ? "YES" : "NO");

    assert.strictEqual(normalRes.widget, null, "Test 3 FAILED: Normal greetings must NOT trigger presentAsWidget!");
    console.log("✅ [PASS] Test 3: Normal conversation did not trigger widget!\n");

    console.log("=================================================");
    console.log("🎉 ALL E2E REAL GEMINI WIDGET CHAINING TESTS PASSED!");
    console.log("=================================================");
}

runLiveTests().catch(err => {
    console.error("❌ E2E Live Test Failed:", err);
    process.exit(1);
});
