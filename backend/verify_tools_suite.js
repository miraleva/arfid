/**
 * Comprehensive Automated Verification for Gemini Tool Calling & ARFID Dietitian Flow
 * with Rate-Limit Delay to prevent 429 errors on free tier limits.
 */

require("dotenv").config();
const { executeTool } = require("./tools");
const calculateCalories = require("./tools/calculateCalories");
const { getDietitianResponse } = require("./services/dietitianService");

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log("=================================================================");
    console.log("🚀 STARTING FUNCTION CALLING & DIETITIAN FLOW VERIFICATION SUITE");
    console.log("=================================================================\n");

    let passedCount = 0;
    let totalCount = 0;

    function assert(condition, message) {
        totalCount++;
        if (condition) {
            console.log(`✅ [PASS] ${message}`);
            passedCount++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
        }
    }

    // --- TEST 0: DIRECT TOOL & ERROR SAFETY UNIT TESTS ---
    console.log("\n--- TEST 0: Direct Tool & Safety Validation ---");
    
    // Valid calculation
    const calcRes = await calculateCalories.execute({
        ingredients: [
            { name: "muz", amount: 1, unit: "adet" },
            { name: "yulaf ezmesi", amount: 50, unit: "gram" },
            { name: "süt", amount: 200, unit: "ml" }
        ]
    });
    assert(calcRes.status === "success", "calculateCalories executes successfully");
    assert(calcRes.total_calories > 0, `calculateCalories calculates calories (${calcRes.total_calories} kcal)`);
    assert(calcRes.items.length === 3, "All 3 ingredients matched properly");

    // Unmatched ingredient
    const unmatchRes = await calculateCalories.execute({
        ingredients: [
            { name: "ejder meyvesi pitaya", amount: 100, unit: "gram" },
            { name: "elma", amount: 1, unit: "adet" }
        ]
    });
    assert(unmatchRes.unmatched.length === 1, "Unmatched ingredient detected in calculateCalories");
    assert(unmatchRes.unmatched[0].requested_name === "ejder meyvesi pitaya", "Correct unmatched food reported");
    assert(unmatchRes.items.length === 1, "Matched food still calculated");

    // Registry Safety 1: Non-existent tool
    const invalidToolRes = await executeTool("nonExistentTool", { foo: "bar" });
    assert(invalidToolRes.status === "error" && invalidToolRes.error_code === "TOOL_NOT_FOUND", "Registry safely catches non-existent tool");

    // Registry Safety 2: Malformed argument
    const malformedRes = await executeTool("calculateCalories", null);
    assert(malformedRes.status === "error" && malformedRes.error_code === "INVALID_ARGUMENTS", "Registry safely catches null/invalid arguments");

    // Rate Limit Safety Wait
    console.log("\n⏳ Waiting 5s before starting live Gemini calls to respect API quotas...");
    await delay(5000);

    // --- INTEGRATION TESTS WITH GEMINI ---

    // TEST 1: Normal Chat (No RAG, No Tool)
    console.log("\n--- TEST 1: Normal Chat (No RAG, No Tool) ---");
    try {
        const res1 = await getDietitianResponse("Bugün biraz stresliyim, yemek yemekte zorlanıyorum.");
        console.log("Response 1:", res1.assistant_response.substring(0, 150) + "...");
        assert(res1.assistant_response && res1.assistant_response.length > 20, "Normal chat produces empathetic response");
    } catch (e) {
        assert(false, "Normal chat failed: " + e.message);
    }

    console.log("⏳ Waiting 10s for quota reset...");
    await delay(10000);

    // TEST 2: RAG Only (Recipe / Food trigger)
    console.log("\n--- TEST 2: RAG Only (Recipe Suggestion) ---");
    try {
        const res2 = await getDietitianResponse("Bana ARFID'e uygun dokusu pürüzsüz çilekli bir tarif önerir misin?");
        console.log("Response 2:", res2.assistant_response.substring(0, 150) + "...");
        assert(res2.assistant_response && res2.assistant_response.length > 30, "RAG flow produces dietary recommendation");
    } catch (e) {
        assert(false, "RAG test failed: " + e.message);
    }

    console.log("⏳ Waiting 10s for quota reset...");
    await delay(10000);

    // TEST 3: Tool Only (Calorie Calculation)
    console.log("\n--- TEST 3: Tool Only (Calorie Calculation) ---");
    try {
        const res3 = await getDietitianResponse("1 adet muz ve 200 ml sütün toplam kalorisi ne kadardır?");
        console.log("Response 3:", res3.assistant_response);
        assert(
            res3.assistant_response.toLowerCase().includes("kalori") || res3.assistant_response.includes("kcal"),
            "Tool flow includes calorie calculation output in response"
        );
    } catch (e) {
        assert(false, "Tool test failed: " + e.message);
    }

    console.log("⏳ Waiting 10s for quota reset...");
    await delay(10000);

    // TEST 4: Hybrid (Recipe Context + Calorie Calculation)
    console.log("\n--- TEST 4: Hybrid (Recipe Context + Calorie Calculation) ---");
    try {
        const res4 = await getDietitianResponse("Tavuk göğsü 150 gram ve 1 porsiyon pirinç pilavı yersem kalori dökümü ne olur?");
        console.log("Response 4:", res4.assistant_response);
        assert(
            res4.assistant_response.toLowerCase().includes("tavuk"),
            "Hybrid response contains food item breakdown"
        );
    } catch (e) {
        assert(false, "Hybrid test failed: " + e.message);
    }

    console.log("⏳ Waiting 10s for quota reset...");
    await delay(10000);

    // TEST 5: Backward Compatibility (Structured output schema & Patient card format)
    console.log("\n--- TEST 5: Backward Compatibility (Structured Format) ---");
    try {
        const res5 = await getDietitianResponse("Domates benim için güvenli bir yiyecek ve çok seviyorum.");
        console.log("Response 5:", res5.assistant_response.substring(0, 150) + "...");
        assert(typeof res5.assistant_response === "string" && res5.assistant_response.length > 20, "Response is clean formatted string");
    } catch (e) {
        assert(false, "Compatibility test failed: " + e.message);
    }

    console.log("⏳ Waiting 10s for quota reset...");
    await delay(10000);

    // TEST 6 (Edge Case A): Unmatched Ingredient
    console.log("\n--- TEST 6 (Edge Case A): Unmatched Ingredient ---");
    try {
        const res6 = await getDietitianResponse("100 gram ejder meyvesi pitaya ve 1 adet muzun kalorisini hesaplar mısın?");
        console.log("Response 6:", res6.assistant_response);
        assert(
            res6.assistant_response.toLowerCase().includes("ejder") || 
            res6.assistant_response.toLowerCase().includes("pitaya") ||
            res6.assistant_response.toLowerCase().includes("veritaban") ||
            res6.assistant_response.toLowerCase().includes("bulunm"),
            "Model acknowledges unmatched ingredient honestly without hallucinating"
        );
    } catch (e) {
        assert(false, "Edge Case A test failed: " + e.message);
    }

    console.log("⏳ Waiting 10s for quota reset...");
    await delay(10000);

    // TEST 7 (Edge Case B): Incomplete Request ("kalori hesapla" without ingredients)
    console.log("\n--- TEST 7 (Edge Case B): Incomplete Request ---");
    try {
        const res7 = await getDietitianResponse("Bana kalori hesapla.");
        console.log("Response 7:", res7.assistant_response);
        assert(
            res7.assistant_response.toLowerCase().includes("malzeme") || 
            res7.assistant_response.toLowerCase().includes("hangi") ||
            res7.assistant_response.toLowerCase().includes("miktar"),
            "Model asks for ingredient details instead of calling tool with empty parameters"
        );
    } catch (e) {
        assert(false, "Edge Case B test failed: " + e.message);
    }

    console.log("\n=================================================================");
    console.log(`🏁 VERIFICATION COMPLETE: ${passedCount} / ${totalCount} ASSERTIONS PASSED`);
    console.log("=================================================================");

    process.exit(passedCount === totalCount ? 0 : 1);
}

runTests();
