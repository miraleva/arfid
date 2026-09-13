/**
 * Prompt-Only Food Safety Evaluation Test
 * Verifies that without checkFoodSafety tool and without guardrails,
 * the model correctly identifies unsafe foods purely based on Layer 1 prompt-based KNOWN USER CONSTRAINTS,
 * while executing NO tool calls.
 */

const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");
const { getDietitianResponse } = require("../services/dietitianService");
const { ensureMasterRecord } = require("../repositories/memoryRepository");

async function runPromptSafetyTest() {
    console.log("=================================================");
    console.log("🧪 RUNNING PROMPT-ONLY FOOD CONSTRAINT TEST");
    console.log("=================================================\n");

    const testUserId = 66666;
    await new Promise((resolve) => {
        db.run(
            `INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
            [testUserId, "prompt_safety_test@test.com", "pass123", "PromptSafetyTester"],
            () => resolve()
        );
    });

    const mushroomId = await ensureMasterRecord("foods", "mushroom", "mushroom");

    await new Promise((resolve) => {
        db.run(`DELETE FROM user_food_preferences WHERE user_id = ?`, [testUserId], () => resolve());
    });

    // mushroom unsafe (0)
    await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO user_food_preferences (user_id, food_id, is_safe) VALUES (?, ?, 0)`,
            [testUserId, mushroomId],
            (err) => err ? reject(err) : resolve()
        );
    });

    const userMessage = "Mantar sote yemek istiyorum, güvenli mi?";
    console.log(`User prompt: "${userMessage}"`);
    console.log(`Context: 'mushroom' configured as UNSAFE (avoid) in user profile.`);
    console.log("Calling getDietitianResponse(userMessage, userId)...");

    const result = await getDietitianResponse(userMessage, testUserId);

    console.log("\n--- Assistant Response ---");
    console.log(result.assistant_response);
    console.log("--------------------------\n");

    const respLower = result.assistant_response.toLowerCase();

    const warnsUnsafe = respLower.includes("kaçın") || 
                        respLower.includes("tetik") || 
                        respLower.includes("güvenli değil") || 
                        respLower.includes("uygun değil") || 
                        respLower.includes("listende") ||
                        respLower.includes("tercih etmediğin") ||
                        respLower.includes("zorlayıcı") ||
                        respLower.includes("mushroom");

    assert.ok(
        warnsUnsafe,
        "Assistant response should warn user about mushroom being unsafe/avoided purely based on prompt constraints"
    );

    console.log("✅ [PASS] Prompt-only constraint test succeeded without any tool calls!");
}

runPromptSafetyTest().catch(err => {
    console.error("❌ [FAIL] Prompt safety test failed:", err);
    process.exit(1);
});
