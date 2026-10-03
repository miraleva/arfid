/**
 * Preference Change Audit Log Test Suite
 * Comprehensive tests for:
 * 1. Food preference deletion and audit logging
 * 2. Sensory trigger deletion and audit logging
 * 3. Prompt injection and gentle reminder instructions (Option A matching)
 * 4. 30-day lookback window & expiration enforcement
 * 5. Irrelevant messages & 0-token overhead efficiency
 * 6. Non-collision with automated memory updates (applyMemoryUpdates)
 * 7. Real performance benchmark with 100 log entries (<20ms latency verification)
 */

const assert = require("assert");
const db = require("../db");
const memoryRepository = require("../repositories/memoryRepository");
const { buildSystemPrompt, formatRecentChangesSection } = require("../promptBuilder");
const { isPreferenceChangeRelevant } = require("../services/dietitianService");
const { validateDietaryOutput } = require("../guardrails/dietaryGuardrail");

console.log("=================================================");
console.log("🧪 RUNNING PREFERENCE AUDIT LOG TEST SUITE");
console.log("=================================================\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
    total++;
    try {
        const res = fn();
        if (res instanceof Promise) {
            return res
                .then(() => {
                    console.log(`✅ [PASS] ${desc}`);
                    passed++;
                })
                .catch(err => {
                    console.error(`❌ [FAIL] ${desc}`);
                    console.error("  Error:", err.message);
                });
        } else {
            console.log(`✅ [PASS] ${desc}`);
            passed++;
        }
    } catch (err) {
        console.error(`❌ [FAIL] ${desc}`);
        console.error("  Error:", err.message);
    }
}

async function runAuditLogTests() {
    const testUserId = 77777;

    // Setup test user
    await new Promise(resolve => {
        db.run(
            `INSERT OR IGNORE INTO users (id, email, password, username) VALUES (?, ?, ?, ?)`,
            [testUserId, "audit_test@test.com", "pass123", "AuditTester"],
            () => resolve()
        );
    });

    // Clean tables for test user
    await new Promise(resolve => {
        db.run(`DELETE FROM preference_change_log WHERE user_id = ?`, [testUserId], () => {
            db.run(`DELETE FROM user_food_preferences WHERE user_id = ?`, [testUserId], () => {
                db.run(`DELETE FROM user_sensory_triggers WHERE user_id = ?`, [testUserId], () => resolve());
            });
        });
    });

    // Ensure Master Records exist
    const riceId = await memoryRepository.ensureMasterRecord('foods', 'Rice', 'rice');
    const crunchyId = await memoryRepository.ensureMasterRecord('sensory_attributes', 'Crunchy Texture', 'crunchy texture');

    // ----------------------------------------------------
    // Test 1: Food Preference Deletion & Audit Logging
    // ----------------------------------------------------
    await it("1. Food preference deletion creates a correct audit log in preference_change_log", async () => {
        // Set Rice as unsafe
        await new Promise(resolve => {
            db.run(
                `INSERT OR REPLACE INTO user_food_preferences (user_id, food_id, is_safe) VALUES (?, ?, 0)`,
                [testUserId, riceId],
                () => resolve()
            );
        });

        // Delete Rice
        const deleted = await memoryRepository.deleteUserFoodPreference(testUserId, riceId);
        assert.strictEqual(deleted, true, "Food preference deletion should succeed");

        // Verify remaining preferences is 0
        const currentPrefs = await memoryRepository.getUserFoodPreferences(testUserId);
        assert.strictEqual(currentPrefs.length, 0, "Food preference should be removed from active preferences");

        // Verify preference_change_log has the record
        const changes = await memoryRepository.getRecentPreferenceChanges(testUserId, 30);
        assert.strictEqual(changes.length, 1, "Should have exactly 1 log record");
        assert.strictEqual(changes[0].item_name.toLowerCase(), "rice");
        assert.strictEqual(changes[0].item_type, "food");
        assert.strictEqual(changes[0].action, "removed");
        assert.strictEqual(changes[0].previous_value, "unsafe");
        assert.strictEqual(changes[0].days_ago, 0);
    });

    // ----------------------------------------------------
    // Test 2: Sensory Trigger Deletion & Audit Logging
    // ----------------------------------------------------
    await it("2. Sensory trigger deletion creates a correct audit log in preference_change_log", async () => {
        // Set Crunchy Texture as problematic
        await new Promise(resolve => {
            db.run(
                `INSERT OR REPLACE INTO user_sensory_triggers (user_id, attribute_id, is_problematic) VALUES (?, ?, 1)`,
                [testUserId, crunchyId],
                () => resolve()
            );
        });

        // Delete Crunchy Texture
        const deleted = await memoryRepository.deleteUserSensoryTrigger(testUserId, crunchyId);
        assert.strictEqual(deleted, true, "Sensory trigger deletion should succeed");

        // Verify preference_change_log has 2 records now
        const changes = await memoryRepository.getRecentPreferenceChanges(testUserId, 30);
        assert.strictEqual(changes.length, 2, "Should have 2 log records");
        const sensoryLog = changes.find(c => c.item_type === "sensory");
        assert.ok(sensoryLog, "Sensory log must exist");
        assert.strictEqual(sensoryLog.action, "removed");
        assert.strictEqual(sensoryLog.previous_value, "problematic");
    });

    // ----------------------------------------------------
    // Test 3: Prompt Injection & Gentle Reminder Instruction
    // ----------------------------------------------------
    await it("3. Prompt includes RECENT PREFERENCE CHANGES when user mentions modified item", async () => {
        const userText = "Bana akşam için sushi veya pirinç pilavı önerir misin?";
        const recentChanges = await memoryRepository.getRecentPreferenceChanges(testUserId, 30);

        // Filter relevant changes using the dietitianService matching logic (Option A)
        const relevantChanges = recentChanges.filter(c => isPreferenceChangeRelevant(c, userText.toLowerCase()));

        assert.strictEqual(relevantChanges.length, 1, "Only Rice should be matched");
        assert.strictEqual(relevantChanges[0].item_name.toLowerCase(), "rice");

        const recentChangesContext = relevantChanges.map(change => {
            const typeLabel = change.item_type === "food" ? "Gıda" : "Duyusal Özellik";
            const stateLabel = change.previous_value === "safe"
                ? "'Güvenli' listesinden ÇIKARILDI (Silindi)"
                : change.previous_value === "problematic"
                    ? "'Duyusal Tetikleyici' listesinden ÇIKARILDI (Silindi)"
                    : "'Kaçınılan / Güvenli Olmayan' listesinden ÇIKARILDI (Silindi)";
            const timeLabel = change.days_ago === 0 ? "bugün" : `${change.days_ago} gün önce`;
            return `- ${change.item_name} (${typeLabel}): ${timeLabel} ${stateLabel}`;
        }).join("\n");

        const prompt = buildSystemPrompt({
            userText,
            masterLists: { foods: ["Rice"], sensory: [], conditions: [] },
            memoryContext: "",
            ragContext: "",
            recentChatContext: "",
            recentChangesContext
        });

        assert.ok(prompt.includes("RECENT PREFERENCE CHANGES (AUDIT LOG - LAST 30 DAYS)"), "Prompt must contain audit log section");
        assert.ok(prompt.includes("Rice"), "Prompt must mention Rice");
        assert.ok(prompt.includes("INSTRUCTION FOR RECENT PREFERENCE CHANGES"), "Prompt must include instructions");
        assert.ok(prompt.includes("doğrudan ENGELLEME"), "Prompt must instruct not to block");
    });

    // ----------------------------------------------------
    // Test 4: 30-Day Lookback Window & Expiration
    // ----------------------------------------------------
    await it("4. Changes older than 30 days are NOT returned by getRecentPreferenceChanges", async () => {
        // Update rice log record to 35 days ago
        const thirtyFiveDaysAgo = Math.floor(Date.now() / 1000) - (35 * 86400);
        await new Promise(resolve => {
            db.run(
                `UPDATE preference_change_log SET changed_at = ? WHERE user_id = ? AND item_name = 'Rice'`,
                [thirtyFiveDaysAgo, testUserId],
                () => resolve()
            );
        });

        const changes = await memoryRepository.getRecentPreferenceChanges(testUserId, 30);
        const hasRice = changes.some(c => c.item_name.toLowerCase() === "rice");
        assert.strictEqual(hasRice, false, "35-day-old Rice log should be excluded by 30-day filter");

        // If lookback is increased to 40 days, it should appear
        const changes40 = await memoryRepository.getRecentPreferenceChanges(testUserId, 40);
        const hasRice40 = changes40.some(c => c.item_name.toLowerCase() === "rice");
        assert.strictEqual(hasRice40, true, "Rice log should appear when lookback is 40 days");
    });

    // ----------------------------------------------------
    // Test 5: Irrelevant Messages & Token Efficiency (0 Token Overhead)
    // ----------------------------------------------------
    await it("5. Irrelevant messages result in empty recentChangesContext (0 token overhead)", async () => {
        const unrelatedUserText = "Merhaba, bugün nasılsın? Hava çok güzel.";
        const recentChanges = await memoryRepository.getRecentPreferenceChanges(testUserId, 30);

        const relevantChanges = recentChanges.filter(c => isPreferenceChangeRelevant(c, unrelatedUserText.toLowerCase()));

        assert.strictEqual(relevantChanges.length, 0, "No changes should match unrelated text");

        const prompt = buildSystemPrompt({
            userText: unrelatedUserText,
            masterLists: { foods: [], sensory: [], conditions: [] },
            memoryContext: "",
            ragContext: "",
            recentChatContext: "",
            recentChangesContext: ""
        });

        assert.strictEqual(prompt.includes("RECENT PREFERENCE CHANGES"), false, "Prompt must NOT contain audit log section for unrelated text");
    });

    // ----------------------------------------------------
    // Test 6: Non-collision with applyMemoryUpdates
    // ----------------------------------------------------
    await it("6. applyMemoryUpdates does NOT pollute preference_change_log", async () => {
        const logCountBefore = (await memoryRepository.getRecentPreferenceChanges(testUserId, 100)).length;

        // Apply memory updates (simulating chat auto-learning)
        await memoryRepository.applyMemoryUpdates(
            testUserId,
            {
                foods: [{ name: "Apple", is_safe: 1 }],
                sensory: [{ name: "Mushy Texture", is_problematic: 1 }],
                conditions: []
            },
            "I like apple but hate mushy texture"
        );

        const logCountAfter = (await memoryRepository.getRecentPreferenceChanges(testUserId, 100)).length;
        assert.strictEqual(logCountAfter, logCountBefore, "Auto-learning must NOT write to preference_change_log");

        // Verify active preferences were updated
        const activePrefs = await memoryRepository.getUserFoodPreferences(testUserId);
        const hasApple = activePrefs.some(p => p.name.toLowerCase() === "apple");
        assert.strictEqual(hasApple, true, "Apple must be in active food preferences");
    });

    // ----------------------------------------------------
    // Test 7 (Madde 6): Real Performance Benchmark with 100 Log Records
    // ----------------------------------------------------
    await it("7. Benchmark: getRecentPreferenceChanges latency with 100 log records is <20ms (typically <2ms)", async () => {
        // Clean and seed 100 log records for test user
        await new Promise(resolve => {
            db.run(`DELETE FROM preference_change_log WHERE user_id = ?`, [testUserId], () => resolve());
        });

        const insertLogStmt = db.prepare(
            `INSERT INTO preference_change_log (user_id, item_type, item_name, action, previous_value, changed_at) VALUES (?, ?, ?, ?, ?, ?)`
        );

        const now = Math.floor(Date.now() / 1000);
        for (let i = 1; i <= 100; i++) {
            const randomDaysAgo = Math.floor(Math.random() * 28); // Within last 28 days
            const changedAt = now - (randomDaysAgo * 86400);
            insertLogStmt.run(testUserId, i % 2 === 0 ? 'food' : 'sensory', `BenchmarkItem_${i}`, 'removed', 'unsafe', changedAt);
        }

        await new Promise(resolve => insertLogStmt.finalize(() => resolve()));

        // Run 50 iterations to measure mean and max latency
        const ITERATIONS = 50;
        const durations = [];

        for (let i = 0; i < ITERATIONS; i++) {
            const start = performance.now();
            const results = await memoryRepository.getRecentPreferenceChanges(testUserId, 30);
            const end = performance.now();
            assert.strictEqual(results.length, 100, "Should retrieve all 100 records");
            durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / ITERATIONS;
        const maxDuration = Math.max(...durations);

        console.log(`\n    📊 [PERFORMANCE METRICS - 100 LOG RECORDS]`);
        console.log(`    - Average query latency: ${avgDuration.toFixed(3)} ms`);
        console.log(`    - Maximum query latency: ${maxDuration.toFixed(3)} ms`);
        console.log(`    - Benchmark iterations: ${ITERATIONS}`);
        console.log(`    - Target SLA threshold: < 20.000 ms\n`);

        assert.ok(avgDuration < 20, `Average latency (${avgDuration}ms) must be under 20ms SLA`);
        assert.ok(maxDuration < 20, `Max latency (${maxDuration}ms) must be under 20ms SLA`);
    });

    // ----------------------------------------------------
    // Test 8 (Doğrulama Adım 2): Silinmiş Gıda + Audit Log + Guardrail Birlikte Çalışma & Çakışmasızlık Testi
    // ----------------------------------------------------
    await it("8. Deleted food passes Guardrail (isSafe: true) with reminder while active unsafe food is BLOCKED (isSafe: false)", async () => {
        // Setup: Ensure Rice and Mushroom exist
        const riceMasterId = await memoryRepository.ensureMasterRecord('foods', 'Rice', 'rice');
        const mushroomMasterId = await memoryRepository.ensureMasterRecord('foods', 'Mushroom', 'mushroom');

        // Clean user preferences
        await new Promise(resolve => {
            db.run(`DELETE FROM user_food_preferences WHERE user_id = ?`, [testUserId], () => {
                db.run(`DELETE FROM preference_change_log WHERE user_id = ?`, [testUserId], () => resolve());
            });
        });

        // 1. User initially had Rice AND Mushroom as unsafe
        await new Promise(resolve => {
            db.run(
                `INSERT INTO user_food_preferences (user_id, food_id, is_safe) VALUES (?, ?, 0), (?, ?, 0)`,
                [testUserId, riceMasterId, testUserId, mushroomMasterId],
                () => resolve()
            );
        });

        // 2. User DELETES Rice from profile (Audit log gets "removed" for Rice)
        const deletedRice = await memoryRepository.deleteUserFoodPreference(testUserId, riceMasterId);
        assert.strictEqual(deletedRice, true, "Rice must be successfully deleted");

        // Verify active preferences: only Mushroom remains
        const activePrefs = await memoryRepository.getUserFoodPreferences(testUserId);
        assert.strictEqual(activePrefs.length, 1, "Only 1 active preference should remain");
        assert.strictEqual(activePrefs[0].name.toLowerCase(), "mushroom");

        // Verify audit log has Rice marked as removed
        const auditLogs = await memoryRepository.getRecentPreferenceChanges(testUserId, 30);
        assert.strictEqual(auditLogs.length, 1, "Audit log should have Rice");
        assert.strictEqual(auditLogs[0].item_name.toLowerCase(), "rice");
        assert.strictEqual(auditLogs[0].action, "removed");

        // 3. User says "Sushi veya pirinç pilavı öner"
        // Active unsafe foods for Guardrail:
        const currentUnsafeFoods = activePrefs.filter(f => f.is_safe === 0).map(f => f.name);
        console.log(`    [Test 8 Info] Active Unsafe Foods for Guardrail: [${currentUnsafeFoods.join(", ")}]`);

        // Simulated Assistant Response suggesting Rice + Gentle Reminder from Audit Log
        const assistantResponseSushi = "Akşam için hafif bir sebzeli sushi veya sade pirinç pilavı tercih edebilirsiniz. Daha önce pirinçten kaçındığınızı belirtmiştiniz, bu konuda bir değişiklik oldu mu? Hâlâ denemek istiyor musunuz?";

        // Run Guardrail on Sushi/Rice response
        const guardrailResultSushi = validateDietaryOutput(assistantResponseSushi, currentUnsafeFoods);
        console.log(`    [Test 8 Info] Guardrail Result for Sushi/Rice: isSafe=${guardrailResultSushi.isSafe}, blockedFoods=[${guardrailResultSushi.blockedFoods.join(", ")}]`);

        assert.strictEqual(guardrailResultSushi.isSafe, true, "Guardrail must NOT block deleted food (Rice)!");
        assert.strictEqual(guardrailResultSushi.blockedFoods.length, 0);

        // 4. In the same system, if model accidentally suggests active unsafe food "Mantar"
        const assistantResponseMushroomBreach = "Size fırında nefis bir mantar sote ve yanında pilav öneriyorum.";
        const guardrailResultMushroom = validateDietaryOutput(assistantResponseMushroomBreach, currentUnsafeFoods);
        console.log(`    [Test 8 Info] Guardrail Result for Active Unsafe (Mushroom): isSafe=${guardrailResultMushroom.isSafe}, blockedFoods=[${guardrailResultMushroom.blockedFoods.join(", ")}]`);

        assert.strictEqual(guardrailResultMushroom.isSafe, false, "Guardrail MUST block active unsafe food (Mushroom)!");
        assert.strictEqual(guardrailResultMushroom.blockedFoods.length, 1);
        assert.strictEqual(guardrailResultMushroom.blockedFoods[0].toLowerCase(), "mushroom");
    });

    // Teardown test user data
    await new Promise(resolve => {
        db.run(`DELETE FROM preference_change_log WHERE user_id = ?`, [testUserId], () => {
            db.run(`DELETE FROM user_food_preferences WHERE user_id = ?`, [testUserId], () => {
                db.run(`DELETE FROM user_sensory_triggers WHERE user_id = ?`, [testUserId], () => resolve());
            });
        });
    });

    console.log(`\n=================================================`);
    console.log(`RESULTS: ${passed}/${total} test groups passed.`);
    console.log(`=================================================`);

    if (passed !== total) {
        process.exit(1);
    }
}

runAuditLogTests();
