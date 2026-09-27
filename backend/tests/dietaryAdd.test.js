/**
 * Dietary Manual Add & Audit Log Unit Tests
 */

const assert = require("assert");
const db = require("../db");
const memoryRepository = require("../repositories/memoryRepository");

console.log("=================================================");
console.log("🧪 RUNNING DIETARY MANUAL ADD & AUDIT LOG TEST SUITE");
console.log("=================================================\n");

let passed = 0;
let total = 0;

async function runTests() {
    const testUserId = 88888;

    // Reset DB for test user
    await new Promise((resolve) => {
        db.serialize(() => {
            db.run("INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, 'test88@test.local', 'hash', 'test88')", [testUserId]);
            db.run("DELETE FROM user_food_preferences WHERE user_id = ?", [testUserId]);
            db.run("DELETE FROM user_sensory_triggers WHERE user_id = ?", [testUserId]);
            db.run("DELETE FROM preference_change_log WHERE user_id = ?", [testUserId]);
            db.run("DELETE FROM foods WHERE id > 1000");
            db.run("DELETE FROM sensory_attributes WHERE id > 1000");
            resolve();
        });
    });

    // Test 1
    total++;
    try {
        const result = await memoryRepository.addUserFoodPreference(testUserId, "Kivi", 1);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.alreadyExists, false);
        assert.strictEqual(result.food.name, "Kivi");
        assert.strictEqual(result.food.is_safe, 1);

        const logs = await memoryRepository.getRecentPreferenceChanges(testUserId, 1);
        const kiviLog = logs.find(l => l.item_name === "Kivi");
        assert.ok(kiviLog, "Kivi should be in preference_change_log");
        assert.strictEqual(kiviLog.action, "added_manual");
        assert.strictEqual(kiviLog.previous_value, "safe");

        console.log("✅ [PASS] 1. addUserFoodPreference adds new food to master foods, user prefs, and audit log");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 1. addUserFoodPreference adds new food:", err.message);
    }

    // Test 2
    total++;
    try {
        // Ensure master foods has Tavuk
        const result = await memoryRepository.addUserFoodPreference(testUserId, "tvuk", 1);
        assert.strictEqual(result.success, true);
        assert.ok(result.food.name.toLowerCase().includes("tavuk") || result.food.name.toLowerCase().includes("chicken"));

        const tvukRaw = await new Promise((res) => {
            db.get("SELECT * FROM foods WHERE name = 'Tvuk'", [], (err, row) => res(row));
        });
        assert.strictEqual(tvukRaw, undefined, "No duplicate 'Tvuk' should exist in foods table");

        console.log("✅ [PASS] 2. addUserFoodPreference fuzzy matches typos ('tvuk') to existing master foods");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 2. addUserFoodPreference fuzzy matches typos:", err.message);
    }

    // Test 3
    total++;
    try {
        // Add Mantar as avoided first
        await memoryRepository.addUserFoodPreference(testUserId, "Mantar", 0);

        // Update Mantar to safe
        const updateResult = await memoryRepository.addUserFoodPreference(testUserId, "Mantar", 1);
        assert.strictEqual(updateResult.success, true);
        assert.strictEqual(updateResult.updated, true);
        assert.strictEqual(updateResult.previousState, "unsafe");
        assert.strictEqual(updateResult.food.is_safe, 1);

        const userPrefs = await memoryRepository.getUserFoodPreferences(testUserId);
        const mantarPref = userPrefs.find(p => p.name.toLowerCase().includes("mantar") || p.name.toLowerCase().includes("mushroom"));
        assert.ok(mantarPref);
        assert.strictEqual(mantarPref.is_safe, 1);

        console.log("✅ [PASS] 3. Cross-category transition: moving food from avoided (0) to safe (1) updates preference and logs status shift");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 3. Cross-category transition:", err.message);
    }

    // Test 4
    total++;
    try {
        const result = await memoryRepository.addUserSensoryTrigger(testUserId, "Püremsi Doku");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.alreadyExists, false);
        assert.strictEqual(result.trigger.is_problematic, 1);

        const logs = await memoryRepository.getRecentPreferenceChanges(testUserId, 1);
        const triggerLog = logs.find(l => l.item_type === "sensory");
        assert.ok(triggerLog);
        assert.strictEqual(triggerLog.action, "added_manual");

        console.log("✅ [PASS] 4. addUserSensoryTrigger adds sensory trigger, master record, and audit log");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 4. addUserSensoryTrigger:", err.message);
    }

    // Test 5
    total++;
    try {
        let threwFood = false;
        try {
            await memoryRepository.addUserFoodPreference(testUserId, "   ", 1);
        } catch (e) {
            threwFood = true;
        }
        assert.strictEqual(threwFood, true, "Empty food name should throw error");

        let threwSensory = false;
        try {
            await memoryRepository.addUserSensoryTrigger(testUserId, "", 1);
        } catch (e) {
            threwSensory = true;
        }
        assert.strictEqual(threwSensory, true, "Empty sensory name should throw error");

        console.log("✅ [PASS] 5. Empty or whitespace input throws error on both food and sensory additions");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 5. Empty input validation:", err.message);
    }

    // Test 6: Pure numbers rejected
    total++;
    try {
        let threwNum = false;
        try {
            await memoryRepository.addUserFoodPreference(testUserId, "8888", 1);
        } catch (e) {
            threwNum = true;
            assert.ok(e.message.includes("en az 1 harf"));
        }
        assert.strictEqual(threwNum, true, "Pure numbers '8888' must be rejected");
        console.log("✅ [PASS] 6. Pure numbers ('8888') are rejected (must contain at least 1 letter)");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 6. Pure numbers rejection:", err.message);
    }

    // Test 7: Dot characters rejected
    total++;
    try {
        let threwDot = false;
        try {
            await memoryRepository.addUserFoodPreference(testUserId, "Pirin.", 1);
        } catch (e) {
            threwDot = true;
            assert.ok(e.message.includes("Nokta veya özel karakter"));
        }
        assert.strictEqual(threwDot, true, "Food name ending with dot ('Pirin.') must be rejected");
        console.log("✅ [PASS] 7. Dot characters ('Pirin.') are rejected");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 7. Dot character rejection:", err.message);
    }

    // Test 8: Script and special characters rejected
    total++;
    try {
        let threwScript = false;
        try {
            await memoryRepository.addUserFoodPreference(testUserId, "<script>alert(1)</script>", 1);
        } catch (e) {
            threwScript = true;
        }
        assert.strictEqual(threwScript, true, "HTML/script injection '<script>' must be rejected");
        console.log("✅ [PASS] 8. HTML/script injection characters are rejected");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 8. Script injection rejection:", err.message);
    }

    // Test 9: Turkish characters and spaces accepted
    total++;
    try {
        const trResult = await memoryRepository.addUserFoodPreference(testUserId, "Kırmızı Et", 1);
        assert.strictEqual(trResult.success, true);
        assert.strictEqual(trResult.food.name, "Kırmızı Et");
        console.log("✅ [PASS] 9. Turkish characters and spaces ('Kırmızı Et') are accepted");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 9. Turkish characters acceptance:", err.message);
    }

    // Test 10: Alphanumeric with hyphen accepted
    total++;
    try {
        const alphaResult = await memoryRepository.addUserFoodPreference(testUserId, "Omega-3", 1);
        assert.strictEqual(alphaResult.success, true);
        assert.strictEqual(alphaResult.food.name, "Omega-3");
        console.log("✅ [PASS] 10. Letters with hyphen and numbers ('Omega-3') are accepted");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 10. Alphanumeric with hyphen acceptance:", err.message);
    }

    // Test 11: Fake non-existent food ("Alöa", "Dvas") is rejected
    total++;
    try {
        let threwFake = false;
        try {
            await memoryRepository.addUserFoodPreference(testUserId, "Alöa", 1, {
                mockOffResult: { exists: false, verified: true, networkError: false }
            });
        } catch (e) {
            threwFake = true;
            assert.ok(e.message.includes("tanınan bir gıda olarak bulunamadı"));
        }
        assert.strictEqual(threwFake, true, "Fake food 'Alöa' must be rejected");
        console.log("✅ [PASS] 11. Fake/non-existent food ('Alöa') is rejected with clear error message");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 11. Fake food rejection:", err.message);
    }

    // Test 12: Real food verified via Open Food Facts creates master food record
    total++;
    try {
        // Ensure "Ejder Meyvesi" is not in test user prefs or master
        const ejderResult = await memoryRepository.addUserFoodPreference(testUserId, "Ejder Meyvesi", 1, {
            mockOffResult: { exists: true, verified: true, networkError: false, productName: "Ejder Meyvesi" }
        });
        assert.strictEqual(ejderResult.success, true);
        assert.strictEqual(ejderResult.food.name, "Ejder Meyvesi");
        console.log("✅ [PASS] 12. Real food verified via Open Food Facts is accepted and creates master record");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 12. OFF real food verification:", err.message);
    }

    // Test 13: Adding "Elma" when user does NOT have "Apple" -> maps to Apple master record cleanly without duplicate error
    total++;
    try {
        // Ensure testUserId has no Apple preference
        const appleMaster = await new Promise((res) => db.get("SELECT id FROM foods WHERE name = 'Apple' OR name = 'apple'", [], (e, r) => res(r)));
        if (appleMaster) {
            await new Promise((res) => db.run("DELETE FROM user_food_preferences WHERE user_id = ? AND food_id = ?", [testUserId, appleMaster.id], res));
        }

        const elmaResult = await memoryRepository.addUserFoodPreference(testUserId, "Elma", 1);
        assert.strictEqual(elmaResult.success, true);
        assert.strictEqual(elmaResult.alreadyExists, false);
        assert.strictEqual(elmaResult.food.name, "Apple");

        console.log("✅ [PASS] 13. Adding 'Elma' when user does NOT have 'Apple' maps to Apple ID without duplicate warning");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 13. TR/EN alias mapping for new preference:", err.message);
    }

    // Test 14: Adding "Elma" when user ALREADY HAS "Apple" -> returns duplicate warning "Apple (Elma)"
    total++;
    try {
        const elmaDupResult = await memoryRepository.addUserFoodPreference(testUserId, "Elma", 1);
        assert.strictEqual(elmaDupResult.success, true);
        assert.strictEqual(elmaDupResult.alreadyExists, true);
        assert.ok(elmaDupResult.food.name.includes("Apple (Elma)"));

        console.log("✅ [PASS] 14. Adding 'Elma' when user ALREADY has 'Apple' returns 'Apple (Elma)' duplicate warning");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 14. TR/EN alias duplicate warning:", err.message);
    }

    // Test 15: Best-effort network failure fallback allows addition with unverified flag
    total++;
    try {
        const netFailResult = await memoryRepository.addUserFoodPreference(testUserId, "Nadir Meyve", 1, {
            mockOffResult: { exists: false, verified: false, networkError: true, error: "TIMEOUT" }
        });
        assert.strictEqual(netFailResult.success, true);
        assert.strictEqual(netFailResult.unverified, true);
        assert.strictEqual(netFailResult.food.name, "Nadir Meyve");

        console.log("✅ [PASS] 15. Best-effort network error fallback allows addition with unverified flag");
        passed++;
    } catch (err) {
        console.error("❌ [FAIL] 15. Best-effort fallback:", err.message);
    }

    console.log("\n=================================================");
    console.log(`RESULTS: ${passed}/${total} tests passed.`);
    console.log("=================================================");

    if (passed !== total) {
        process.exit(1);
    }
}

runTests();
