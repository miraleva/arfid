// backend/memoryOps.js
const sqlite3 = require("sqlite3").verbose();

/**
 * Fetch user constraints from the database.
 * Returns a compact string summary of safe/unsafe foods, triggers, and conditions.
 * Limits to 10 items per category to keep context small.
 */
function getUserConstraints(db, userId) {
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
 */
function ensureMasterRecord(db, table, name, originalMessage) {
    return new Promise((resolve, reject) => {
        const normalizedName = name.trim().toLowerCase();

        // Anti-hallucination check
        if (originalMessage) {
            const normalizedMsg = originalMessage.toLowerCase();
            // Simple substring check. 
            // NOTE: A more robust check might use word boundaries, but this covers basic safety.
            if (!normalizedMsg.includes(normalizedName)) {
                console.log(`[Memory Safety] Skipped inserting '${name}' into ${table}: Not found in user message.`);
                return resolve(null); // Resolve null to indicate skip
            }
        }

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
 */
async function applyMemoryUpdates(db, userId, updates, originalMessage) {
    if (!userId || !updates) return;

    try {
        // 1. Process Foods
        if (updates.foods && Array.isArray(updates.foods)) {
            for (const item of updates.foods.slice(0, 5)) { // Max 5 items safety limit
                if (!item.name || item.is_safe === undefined) continue;

                try {
                    const foodId = await ensureMasterRecord(db, 'foods', item.name, originalMessage);
                    if (foodId) {
                        db.run(`INSERT OR REPLACE INTO user_food_preferences (user_id, food_id, is_safe) VALUES (?, ?, ?)`,
                            [userId, foodId, item.is_safe]);
                        console.log(`[Memory] Updated food pref: ${item.name} -> safe=${item.is_safe}`);
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
                    const attrId = await ensureMasterRecord(db, 'sensory_attributes', item.name, originalMessage);
                    if (attrId) {
                        db.run(`INSERT OR REPLACE INTO user_sensory_triggers (user_id, attribute_id, is_problematic) VALUES (?, ?, ?)`,
                            [userId, attrId, item.is_problematic]);
                        console.log(`[Memory] Updated sensory trigger: ${item.name} -> prob=${item.is_problematic}`);
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
                    const condId = await ensureMasterRecord(db, 'conditions', item.name, originalMessage);
                    if (condId) {
                        db.run(`INSERT OR REPLACE INTO user_conditions (user_id, condition_id, has_condition) VALUES (?, ?, ?)`,
                            [userId, condId, item.has_condition]);
                        console.log(`[Memory] Updated condition: ${item.name} -> has=${item.has_condition}`);
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

module.exports = {
    getUserConstraints,
    applyMemoryUpdates
};
