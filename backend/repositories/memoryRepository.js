/**
 * Memory Repository
 * Handles all direct SQLite database queries for user constraints, master lists, and memory updates.
 */

const db = require("../db");

/**
 * Fetch user constraints from the database.
 * Returns a compact string summary of safe/unsafe foods, triggers, and conditions.
 * Limits to 10 items per category to keep context small.
 * 
 * @param {number} userId - Target user ID
 * @returns {Promise<string>} Formatted constraints string
 */
function getUserConstraints(userId) {
    return new Promise((resolve, reject) => {
        if (!userId) {
            return resolve("");
        }

        const queries = {
            foods: `
                SELECT f.name, ufp.is_safe 
                FROM user_food_preferences ufp
                JOIN foods f ON ufp.food_id = f.id
                WHERE ufp.user_id = ?
            `,
            sensory: `
                SELECT sa.name, ust.is_problematic 
                FROM user_sensory_triggers ust
                JOIN sensory_attributes sa ON ust.attribute_id = sa.id
                WHERE ust.user_id = ? AND ust.is_problematic = 1
            `,
            conditions: `
                SELECT c.name, uc.has_condition 
                FROM user_conditions uc
                JOIN conditions c ON uc.condition_id = c.id
                WHERE uc.user_id = ? AND uc.has_condition = 1
            `
        };

        const contextParts = [];

        // Execute all queries in parallel
        db.serialize(() => {
            let pending = 3;
            const constraints = {
                unsafeFoods: [],
                safeFoods: [],
                triggers: [],
                conditions: []
            };

            const checkDone = () => {
                pending--;
                if (pending === 0) {
                    // Format the output
                    const formatList = (title, items, limit) => {
                        if (items.length === 0) return null;
                        const visible = items.slice(0, limit).map(i => i.name).join(", ");
                        const remaining = items.length - limit;
                        if (remaining > 0) {
                            return `${title}: ${visible}, and ${remaining} more`;
                        }
                        return `${title}: ${visible}`;
                    };

                    const foodStr = formatList("AVOID FOODS", constraints.unsafeFoods, 10);
                    if (foodStr) contextParts.push(foodStr);

                    const triggerStr = formatList("SENSORY TRIGGERS", constraints.triggers, 10);
                    if (triggerStr) contextParts.push(triggerStr);

                    const conditionStr = formatList("CONDITIONS", constraints.conditions, 10);
                    if (conditionStr) contextParts.push(conditionStr);

                    resolve(contextParts.join("\n"));
                }
            };

            db.all(queries.foods, [userId], (err, rows) => {
                if (!err && rows) {
                    rows.forEach(r => {
                        if (r.is_safe === 0) constraints.unsafeFoods.push(r);
                        else constraints.safeFoods.push(r);
                    });
                }
                checkDone();
            });

            db.all(queries.sensory, [userId], (err, rows) => {
                if (!err && rows) constraints.triggers = rows;
                checkDone();
            });

            db.all(queries.conditions, [userId], (err, rows) => {
                if (!err && rows) constraints.conditions = rows;
                checkDone();
            });
        });
    });
}

/**
 * Ensures a master record exists for an item.
 * CRITICAL SAFETY CHECK: Only inserts if the item name appears in the user's original message.
 * This prevents hallucinated items from polluting the master lists.
 * 
 * @param {string} table - Table name (foods, sensory_attributes, conditions)
 * @param {string} name - Item name
 * @param {string} originalMessage - Raw user input text for anti-hallucination check
 * @returns {Promise<number>} ID of the master record
 */
function ensureMasterRecord(table, name, originalMessage) {
    return new Promise((resolve, reject) => {
        const normalizedName = name.trim().toLowerCase();

        db.get(`SELECT id FROM ${table} WHERE name = ?`, [name], (err, row) => {
            if (err) return reject(err);
            if (row) {
                resolve(row.id);
            } else {
                db.run(`INSERT INTO ${table} (name) VALUES (?)`, [name], function (err) {
                    if (err) return reject(err);
                    console.log(`[Memory] Created new master record in ${table}: ${name}`);
                    resolve(this.lastID);
                });
            }
        });
    });
}

/**
 * Applies memory updates to the database.
 * Handles Foods, Sensory Attributes, and Conditions.
 * 
 * @param {number} userId - Target user ID
 * @param {import('../types').MemoryUpdates} updates - Extracted updates from LLM
 * @param {string} originalMessage - Original user message to prevent hallucinations
 * @returns {Promise<void>}
 */
async function applyMemoryUpdates(userId, updates, originalMessage) {
    if (!userId || !updates) return;

    try {
        // 1. Process Foods
        if (updates.foods && Array.isArray(updates.foods)) {
            for (const item of updates.foods.slice(0, 5)) { // Max 5 items safety limit
                if (!item.name || item.is_safe === undefined) continue;

                try {
                    const foodId = await ensureMasterRecord('foods', item.name, originalMessage);
                    if (foodId) {
                        await new Promise((resolveRun, rejectRun) => {
                            db.run(`INSERT OR REPLACE INTO user_food_preferences (user_id, food_id, is_safe) VALUES (?, ?, ?)`,
                                [userId, foodId, item.is_safe], (runErr) => {
                                    if (runErr) return rejectRun(runErr);
                                    console.log(`[Memory] Updated food pref: ${item.name} -> safe=${item.is_safe}`);
                                    resolveRun();
                                });
                        });
                    }
                } catch (e) {
                    console.error(`[Memory Error] Food update failed for ${item.name}:`, e.message);
                }
            }
        }

        // 2. Process Sensory Attributes
        if (updates.sensory && Array.isArray(updates.sensory)) {
            for (const item of updates.sensory.slice(0, 5)) {
                if (!item.name || item.is_problematic === undefined) continue;

                try {
                    const attrId = await ensureMasterRecord('sensory_attributes', item.name, originalMessage);
                    if (attrId) {
                        await new Promise((resolveRun, rejectRun) => {
                            db.run(`INSERT OR REPLACE INTO user_sensory_triggers (user_id, attribute_id, is_problematic) VALUES (?, ?, ?)`,
                                [userId, attrId, item.is_problematic], (runErr) => {
                                    if (runErr) return rejectRun(runErr);
                                    console.log(`[Memory] Updated sensory trigger: ${item.name} -> prob=${item.is_problematic}`);
                                    resolveRun();
                                });
                        });
                    }
                } catch (e) {
                    console.error(`[Memory Error] Sensory update failed for ${item.name}:`, e.message);
                }
            }
        }

        // 3. Process Conditions
        if (updates.conditions && Array.isArray(updates.conditions)) {
            for (const item of updates.conditions.slice(0, 5)) {
                if (!item.name || item.has_condition === undefined) continue;

                try {
                    const condId = await ensureMasterRecord('conditions', item.name, originalMessage);
                    if (condId) {
                        await new Promise((resolveRun, rejectRun) => {
                            db.run(`INSERT OR REPLACE INTO user_conditions (user_id, condition_id, has_condition) VALUES (?, ?, ?)`,
                                [userId, condId, item.has_condition], (runErr) => {
                                    if (runErr) return rejectRun(runErr);
                                    console.log(`[Memory] Updated condition: ${item.name} -> has=${item.has_condition}`);
                                    resolveRun();
                                });
                        });
                    }
                } catch (e) {
                    console.error(`[Memory Error] Condition update failed for ${item.name}:`, e.message);
                }
            }
        }

    } catch (globalErr) {
        console.error("[Memory] Global update error:", globalErr);
    }
}

/**
 * Fetches all items from master tables for semantic mapping.
 * 
 * @returns {Promise<import('../types').MasterLists>} Master lists of foods, sensory, and conditions
 */
function getMasterLists() {
    return new Promise((resolve, reject) => {
        const queries = {
            foods: "SELECT name FROM foods",
            sensory: "SELECT name FROM sensory_attributes",
            conditions: "SELECT name FROM conditions"
        };

        const lists = {
            foods: [],
            sensory: [],
            conditions: []
        };

        db.serialize(() => {
            let pending = 3;
            const checkDone = () => {
                pending--;
                if (pending === 0) resolve(lists);
            };

            db.all(queries.foods, [], (err, rows) => {
                if (!err && rows) lists.foods = rows.map(r => r.name);
                checkDone();
            });

            db.all(queries.sensory, [], (err, rows) => {
                if (!err && rows) lists.sensory = rows.map(r => r.name);
                checkDone();
            });

            db.all(queries.conditions, [], (err, rows) => {
                if (!err && rows) lists.conditions = rows.map(r => r.name);
                checkDone();
            });
        });
    });
}

/**
 * Fetches user's raw food preferences list (safe/unsafe).
 * 
 * @param {number} userId - Target user ID
 * @returns {Promise<Array<{food_id: number, name: string, is_safe: number}>>}
 */
function getUserFoodPreferences(userId) {
    return new Promise((resolve, reject) => {
        if (!userId) return resolve([]);

        const sql = `
            SELECT f.id AS food_id, f.name, ufp.is_safe 
            FROM user_food_preferences ufp
            JOIN foods f ON ufp.food_id = f.id
            WHERE ufp.user_id = ?
            ORDER BY f.name ASC
        `;

        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

/**
 * Fetches user's raw problematic sensory triggers.
 * Conscious architectural choice: Queries ONLY is_problematic = 1 records,
 * as sensory fit evaluation checks for friction against established triggers.
 * 
 * @param {number} userId - Target user ID
 * @returns {Promise<Array<{attribute_id: number, name: string, is_problematic: number}>>}
 */
function getUserSensoryTriggers(userId) {
    return new Promise((resolve, reject) => {
        if (!userId) return resolve([]);

        const sql = `
            SELECT sa.id AS attribute_id, sa.name, ust.is_problematic 
            FROM user_sensory_triggers ust
            JOIN sensory_attributes sa ON ust.attribute_id = sa.id
            WHERE ust.user_id = ? AND ust.is_problematic = 1
            ORDER BY sa.name ASC
        `;

        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

/**
 * Logs a preference change (audit trail) into preference_change_log.
 * 
 * @param {number} userId - Target user ID
 * @param {'food'|'sensory'} itemType - Type of item ('food' or 'sensory')
 * @param {string} itemName - Name of the item
 * @param {'removed'|'added_manual'} action - Action taken
 * @param {string} [previousValue] - Previous state ('safe', 'unsafe', 'problematic')
 * @returns {Promise<boolean>}
 */
function logPreferenceChange(userId, itemType, itemName, action, previousValue = null) {
    return new Promise((resolve, reject) => {
        if (!userId || !itemType || !itemName || !action) return resolve(false);

        const changedAt = Math.floor(Date.now() / 1000);
        const sql = `
            INSERT INTO preference_change_log (user_id, item_type, item_name, action, previous_value, changed_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [userId, itemType, itemName.trim(), action, previousValue, changedAt], function (err) {
            if (err) {
                console.error("[Memory Log Error] Failed to log preference change:", err);
                return resolve(false);
            }
            console.log(`[Memory Log] Logged preference change: user=${userId}, type=${itemType}, item=${itemName}, action=${action}`);
            resolve(true);
        });
    });
}

/**
 * Retrieves preference changes for a user within the last N days (default 30 days).
 * 
 * @param {number} userId - Target user ID
 * @param {number} [days=30] - Lookback window in days
 * @returns {Promise<Array<{id: number, item_type: string, item_name: string, action: string, previous_value: string, changed_at: number, days_ago: number}>>}
 */
function getRecentPreferenceChanges(userId, days = 30) {
    return new Promise((resolve, reject) => {
        if (!userId) return resolve([]);

        const sql = `
            SELECT id, item_type, item_name, action, previous_value, changed_at,
                   CAST((strftime('%s', 'now') - changed_at) / 86400 AS INTEGER) AS days_ago
            FROM preference_change_log
            WHERE user_id = ? AND changed_at >= (strftime('%s', 'now') - (? * 86400))
            ORDER BY changed_at DESC
        `;

        db.all(sql, [userId, days], (err, rows) => {
            if (err) {
                console.error("[Memory Log Error] Failed to fetch recent preference changes:", err);
                return resolve([]);
            }
            resolve(rows || []);
        });
    });
}

/**
 * Deletes a food preference for a specific user and logs the removal to preference_change_log.
 * 
 * @param {number} userId - Target user ID
 * @param {number} foodId - Food master ID
 * @returns {Promise<boolean>}
 */
function deleteUserFoodPreference(userId, foodId) {
    return new Promise((resolve, reject) => {
        if (!userId || !foodId) return resolve(false);

        // First find item details for audit log
        const findSql = `
            SELECT f.name, ufp.is_safe 
            FROM user_food_preferences ufp
            JOIN foods f ON ufp.food_id = f.id
            WHERE ufp.user_id = ? AND ufp.food_id = ?
        `;

        db.get(findSql, [userId, foodId], (findErr, itemRow) => {
            if (findErr) {
                console.error("[Memory Error] Failed to inspect food preference before delete:", findErr);
            }

            const sql = `DELETE FROM user_food_preferences WHERE user_id = ? AND food_id = ?`;
            db.run(sql, [userId, foodId], async function (err) {
                if (err) return reject(err);
                const changes = this.changes;

                if (changes > 0 && itemRow && itemRow.name) {
                    const prevVal = itemRow.is_safe === 1 ? 'safe' : 'unsafe';
                    await logPreferenceChange(userId, 'food', itemRow.name, 'removed', prevVal);
                }

                resolve(changes > 0);
            });
        });
    });
}

/**
 * Deletes a sensory trigger preference for a specific user and logs the removal to preference_change_log.
 * 
 * @param {number} userId - Target user ID
 * @param {number} attributeId - Sensory attribute master ID
 * @returns {Promise<boolean>}
 */
function deleteUserSensoryTrigger(userId, attributeId) {
    return new Promise((resolve, reject) => {
        if (!userId || !attributeId) return resolve(false);

        // First find item details for audit log
        const findSql = `
            SELECT sa.name, ust.is_problematic 
            FROM user_sensory_triggers ust
            JOIN sensory_attributes sa ON ust.attribute_id = sa.id
            WHERE ust.user_id = ? AND ust.attribute_id = ?
        `;

        db.get(findSql, [userId, attributeId], (findErr, itemRow) => {
            if (findErr) {
                console.error("[Memory Error] Failed to inspect sensory trigger before delete:", findErr);
            }

            const sql = `DELETE FROM user_sensory_triggers WHERE user_id = ? AND attribute_id = ?`;
            db.run(sql, [userId, attributeId], async function (err) {
                if (err) return reject(err);
                const changes = this.changes;

                if (changes > 0 && itemRow && itemRow.name) {
                    const prevVal = itemRow.is_problematic === 1 ? 'problematic' : 'safe';
                    await logPreferenceChange(userId, 'sensory', itemRow.name, 'removed', prevVal);
                }

                resolve(changes > 0);
            });
        });
    });
}

module.exports = {
    getUserConstraints,
    applyMemoryUpdates,
    getMasterLists,
    ensureMasterRecord,
    getUserFoodPreferences,
    getUserSensoryTriggers,
    deleteUserFoodPreference,
    deleteUserSensoryTrigger,
    logPreferenceChange,
    getRecentPreferenceChanges
};
