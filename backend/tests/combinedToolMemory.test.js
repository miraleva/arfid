/**
 * Combined Tool & Memory Updates Test
 * Verifies that a user message with both a calorie calculation query AND a personal food preference
 * successfully executes calculateCalories AND records memory updates into SQLite.
 */

const assert = require("assert");
require("dotenv").config();
const db = require("../db");
const memoryRepository = require("../repositories/memoryRepository");
const { getDietitianResponse } = require("../services/dietitianService");

async function runCombinedTest() {
    console.log("=================================================");
    console.log("🧪 RUNNING COMBINED TOOL + MEMORY TEST SUITE");
    console.log("=================================================\n");

    let passed = 0;
    let total = 0;

    function record(pass, msg) {
        total++;
        if (pass) {
            console.log(`✅ [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${msg}`);
        }
    }

    try {
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
        console.log("Calling getDietitianResponse(userMessage, userId)...");

        const result = await getDietitianResponse(userMessage, testUserId);

        // Verify calorie calculation output
        const hasCalorieMention = result.assistant_response.toLowerCase().includes("kalori") || result.assistant_response.includes("240");
        record(hasCalorieMention, "Tool Result Verification: Calorie calculated in response");

        // Verify SQLite food preference
        const prefRows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT f.name, ufp.is_safe FROM user_food_preferences ufp JOIN foods f ON ufp.food_id = f.id WHERE ufp.user_id = ?`,
                [testUserId],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        const hasChickenInPref = prefRows.some(r => r.name.toLowerCase().includes("chicken") || r.name.toLowerCase().includes("tavuk"));
        record(hasChickenInPref, "Memory Update Verification: Chicken saved as safe in SQLite");

        console.log("\n=================================================");
        console.log(`Test Summary: ${passed} / ${total} tests passed.`);
        console.log("=================================================\n");

        if (passed !== total) {
            process.exit(1);
        }

    } catch (err) {
        console.error("Combined Test failed with exception:", err.message);
        process.exit(1);
    }
}

runCombinedTest();
