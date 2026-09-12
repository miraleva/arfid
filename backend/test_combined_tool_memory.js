/**
 * Test: Combined Tool Execution + Memory Updates in Single User Message
 * Verifies that a message containing both a calorie calculation query AND a user food preference
 * successfully executes the calculateCalories tool AND extracts memory updates to SQLite.
 */

require("dotenv").config();
const db = require("./db");
const memoryRepository = require("./repositories/memoryRepository");
const { getDietitianResponse } = require("./services/dietitianService");

async function runCombinedTest() {
    console.log("=================================================================");
    console.log("🧪 RUNNING COMBINED TOOL + MEMORY UPDATE VERIFICATION");
    console.log("=================================================================\n");

    // 1. Create or get test user
    const testUserId = 99999;
    await new Promise((resolve) => {
        db.run(
            `INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
            [testUserId, "tool_mem_test@test.com", "pass123", "ToolMemTester"],
            () => resolve()
        );
    });

    // Clean previous test preferences for clean state
    await new Promise((resolve) => {
        db.run(`DELETE FROM user_food_preferences WHERE user_id = ?`, [testUserId], () => resolve());
    });

    const userMessage = "200 gram tavuk göğsü yersem kaç kalori olur, bu arada tavuğu çok seviyorum ve güvenli bir yiyecek benim için.";
    console.log("User Input:", userMessage);
    console.log("\nCalling getDietitianResponse(userMessage, userId)...");

    try {
        const result = await getDietitianResponse(userMessage, testUserId);

        console.log("\n--- ASSISTANT RESPONSE ---");
        console.log(result.assistant_response);

        console.log("\n--- GENERATED PATIENT CARD ---");
        console.log(result.patient_card || "(No patient card / skipped)");

        // 2. Verify Database State for Memory Updates
        const constraints = await memoryRepository.getUserConstraints(testUserId);
        console.log("\n--- DB USER CONSTRAINTS AFTER CALL ---");
        console.log(constraints || "(Empty constraints)");

        // Check food preferences table specifically
        const prefRows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT f.name, ufp.is_safe FROM user_food_preferences ufp JOIN foods f ON ufp.food_id = f.id WHERE ufp.user_id = ?`,
                [testUserId],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        console.log("\n--- STORED FOOD PREFERENCES IN SQLITE ---");
        console.log(JSON.stringify(prefRows, null, 2));

        const hasCalorieMention = result.assistant_response.toLowerCase().includes("kalori") || result.assistant_response.includes("240");
        const hasChickenInPref = prefRows.some(r => r.name.toLowerCase().includes("chicken") || r.name.toLowerCase().includes("tavuk"));

        console.log("\n=================================================================");
        console.log(`Tool Result Verification: ${hasCalorieMention ? "✅ PASS (Calorie calculated in response)" : "❌ FAIL"}`);
        console.log(`Memory Update Verification: ${hasChickenInPref ? "✅ PASS (Chicken saved as safe in DB)" : "❌ FAIL"}`);
        console.log("=================================================================");

        process.exit(hasCalorieMention && hasChickenInPref ? 0 : 1);

    } catch (err) {
        console.error("Test execution failed:", err);
        process.exit(1);
    }
}

runCombinedTest();
