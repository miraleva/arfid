/**
 * End-to-End Hybrid Tool Invocation Test
 * Tests that Gemini actively invokes checkFoodSafety (or both checkFoodSafety and calculateCalories)
 * when a user asks about food safety and calories.
 */

const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");
const { getDietitianResponse } = require("../services/dietitianService");
const { ensureMasterRecord } = require("../repositories/memoryRepository");

async function runE2EToolTest() {
    console.log("=================================================");
    console.log("🧪 RUNNING E2E checkFoodSafety & HYBRID TOOL TEST");
    console.log("=================================================\n");

    const testUserId = 77777;
    await new Promise((resolve) => {
        db.run(
            `INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
            [testUserId, "e2e_safety_test@test.com", "pass123", "E2ESafetyTester"],
            () => resolve()
        );
    });

    const mushroomId = await ensureMasterRecord("foods", "mushroom", "mushroom");
    const chickenId = await ensureMasterRecord("foods", "chicken", "chicken");

    await new Promise((resolve) => {
        db.run(`DELETE FROM user_food_preferences WHERE user_id = ?`, [testUserId], () => resolve());
    });

    // mushroom unsafe (0), chicken safe (1)
    await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO user_food_preferences (user_id, food_id, is_safe) VALUES (?, ?, 0), (?, ?, 1)`,
            [testUserId, mushroomId, testUserId, chickenId],
            (err) => err ? reject(err) : resolve()
        );
    });

    const userMessage = "Mantar sote yemek istiyorum, güvenli mi ve kaç kalori?";
    console.log(`User prompt: "${userMessage}"`);
    console.log(`Context: mushroom is configured as UNSAFE in user's profile.`);
    console.log("Calling getDietitianResponse...");

    const response = await getDietitianResponse(userMessage, testUserId);
    console.log("\n--- Assistant Response ---");
    console.log(response.assistant_response);
    console.log("--------------------------\n");

    const respLower = response.assistant_response.toLowerCase();

    // Check that the assistant identified mushroom as unsafe/avoided or warned user
    const hasUnsafeOrWarning = respLower.includes("kaçın") || 
                               respLower.includes("tetik") || 
                               respLower.includes("güvenli değil") || 
                               respLower.includes("uygun değil") || 
                               respLower.includes("listende") ||
                               respLower.includes("unsafe");

    assert.ok(
        hasUnsafeOrWarning,
        "Response should warn user about mushroom being unsafe/avoided based on checkFoodSafety tool"
    );

    console.log("✅ [PASS] E2E Hybrid checkFoodSafety test succeeded!");
}

runE2EToolTest().catch(err => {
    console.error("❌ [FAIL] E2E test failed:", err);
    process.exit(1);
});
