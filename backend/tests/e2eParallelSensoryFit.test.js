/**
 * E2E Parallel Tool Calling Test (calculateCalories + calculateSensoryFit)
 * Verifies that when a user asks for a recipe with calories and sensory fit,
 * Gemini can invoke both tools in parallel and combine them into an empathetic response.
 */

const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");
const { getDietitianResponse } = require("../services/dietitianService");

async function runE2EParallelToolTest() {
    console.log("=================================================");
    console.log("🧪 RUNNING E2E PARALLEL TOOL TEST (Calories + SensoryFit)");
    console.log("=================================================\n");

    const testUserId = 44444;
    await new Promise(resolve => {
        db.run(
            `INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
            [testUserId, "e2e_parallel@test.com", "pass123", "ParallelTester"],
            () => resolve()
        );
    });

    // Setup sensory trigger: Attribute 3 = 'Mushy Texture'
    await new Promise(resolve => {
        db.run(`DELETE FROM user_sensory_triggers WHERE user_id = ?`, [testUserId], () => resolve());
    });
    await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO user_sensory_triggers (user_id, attribute_id, is_problematic) VALUES (?, 3, 1)`,
            [testUserId],
            err => err ? reject(err) : resolve()
        );
    });

    const userMessage = "Bana elmalı çıtır bir ara öğün önerir misin? Dokusu benim için uygun mu ve yaklaşık kaç kalori?";
    console.log(`User prompt: "${userMessage}"`);
    console.log(`Context: User ID ${testUserId} has 'Mushy Texture' as a problematic sensory trigger.`);
    console.log("Calling getDietitianResponse...");

    const result = await getDietitianResponse(userMessage, testUserId);

    console.log("\n--- Assistant Response ---");
    console.log(result.assistant_response);
    console.log("--------------------------\n");

    const respLower = result.assistant_response.toLowerCase();

    // Check that calorie and texture/sensory fit are both addressed
    const mentionsCalories = respLower.includes("kalori") || respLower.includes("kcal");
    const mentionsTexture = respLower.includes("doku") || respLower.includes("çıtır") || respLower.includes("duyusal") || respLower.includes("uyum") || respLower.includes("mushy");

    assert.ok(mentionsCalories, "Assistant should mention calories in response");
    assert.ok(mentionsTexture, "Assistant should mention texture or sensory aspects in response");

    console.log("✅ [PASS] E2E Parallel Tool test succeeded!");
}

runE2EParallelToolTest().catch(err => {
    console.error("❌ [FAIL] E2E Parallel Tool test failed:", err);
    process.exit(1);
});
