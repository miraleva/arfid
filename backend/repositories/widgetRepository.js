/**
 * Widget Repository
 * Handles direct SQLite database operations for the 'saved_widgets' table.
 * Includes duplicate detection (within 5-minute sliding window) and message association.
 */

const db = require("../db");

/**
 * Saves a widget for a user with duplicate protection and optional message linkage.
 * If a widget with the same title and type was created by the user within the last 5 minutes,
 * insertion is skipped to prevent spam/duplicates.
 * 
 * @param {number} userId - User ID
 * @param {'recipe' | 'nutrition'} widgetType - Widget type
 * @param {string} title - Widget title
 * @param {Object} widgetData - Full structured widget payload
 * @param {number} [relatedMessageId=null] - Associated chat_messages.id
 * @param {number} [conversationId=null] - Associated conversations.id
 * @returns {Promise<Object|null>} Saved widget record or null if duplicate/error
 */
async function saveWidget(userId, widgetType, title, widgetData, relatedMessageId = null, conversationId = null) {
    if (!userId || !widgetType || !title || !widgetData) {
        return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const fiveMinutesAgo = nowSeconds - 300;

    // 1. Duplicate Check: same user, same type, same title within last 5 minutes
    const existing = await new Promise((resolve) => {
        db.get(
            `SELECT id FROM saved_widgets 
             WHERE user_id = ? AND widget_type = ? AND title = ? COLLATE NOCASE AND created_at >= ? 
             LIMIT 1`,
            [userId, widgetType, title.trim(), fiveMinutesAgo],
            (err, row) => {
                if (err) {
                    console.error("[WidgetRepo] Duplicate check error:", err.message);
                    return resolve(null);
                }
                resolve(row || null);
            }
        );
    });

    if (existing) {
        console.log(`[Widget] Duplicate detected, skipping save: "${title.trim()}" (User: ${userId})`);
        return null;
    }

    const serializedData = typeof widgetData === "string" ? widgetData : JSON.stringify(widgetData);

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO saved_widgets (user_id, conversation_id, related_message_id, widget_type, title, widget_data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, conversationId || null, relatedMessageId || null, widgetType, title.trim(), serializedData, nowSeconds],
            function (err) {
                if (err) {
                    console.error("[WidgetRepo] Error saving widget:", err.message);
                    return resolve(null); // Fail gracefully
                }
                resolve({
                    id: this.lastID,
                    userId,
                    conversationId: conversationId || null,
                    relatedMessageId: relatedMessageId || null,
                    widgetType,
                    title: title.trim(),
                    widgetData,
                    createdAt: nowSeconds
                });
            }
        );
    });
}

/**
 * Retrieves all saved widgets for a user ordered by newest first.
 * 
 * @param {number} userId - User ID
 * @param {number} [limit=50] - Max items
 * @returns {Promise<Array<Object>>} List of saved widgets with parsed widget_data
 */
function getUserWidgets(userId, limit = 50) {
    return new Promise((resolve, reject) => {
        if (!userId) return resolve([]);

        db.all(
            `SELECT id, user_id, conversation_id, related_message_id, widget_type, title, widget_data, is_pinned, created_at 
             FROM saved_widgets 
             WHERE user_id = ? 
             ORDER BY is_pinned DESC, id DESC 
             LIMIT ?`,
            [userId, limit],
            (err, rows) => {
                if (err) {
                    console.error("[WidgetRepo] Error getting user widgets:", err.message);
                    return resolve([]);
                }

                const parsed = (rows || []).map(row => {
                    let parsedData = null;
                    try {
                        parsedData = JSON.parse(row.widget_data);
                    } catch (e) {
                        parsedData = row.widget_data;
                    }
                    return {
                        id: row.id,
                        user_id: row.user_id,
                        conversation_id: row.conversation_id,
                        related_message_id: row.related_message_id,
                        widget_type: row.widget_type,
                        title: row.title,
                        widget_data: parsedData,
                        is_pinned: row.is_pinned === 1 ? 1 : 0,
                        created_at: row.created_at
                    };
                });
                resolve(parsed);
            }
        );
    });
}

/**
 * Retrieves a single widget by ID and user ownership.
 * 
 * @param {number} id - Widget ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>}
 */
function getWidgetById(id, userId) {
    return new Promise((resolve, reject) => {
        if (!id || !userId) return resolve(null);

        db.get(
            `SELECT id, user_id, conversation_id, related_message_id, widget_type, title, widget_data, is_pinned, created_at 
             FROM saved_widgets 
             WHERE id = ? AND user_id = ?`,
            [id, userId],
            (err, row) => {
                if (err || !row) return resolve(null);

                let parsedData = null;
                try {
                    parsedData = JSON.parse(row.widget_data);
                } catch (e) {
                    parsedData = row.widget_data;
                }

                resolve({
                    id: row.id,
                    user_id: row.user_id,
                    conversation_id: row.conversation_id,
                    related_message_id: row.related_message_id,
                    widget_type: row.widget_type,
                    title: row.title,
                    widget_data: parsedData,
                    is_pinned: row.is_pinned === 1 ? 1 : 0,
                    created_at: row.created_at
                });
            }
        );
    });
}

/**
 * Updates the related_message_id of an existing widget.
 * 
 * @param {number} widgetId - Widget ID
 * @param {number} relatedMessageId - chat_messages.id
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
function updateRelatedMessageId(widgetId, relatedMessageId, userId) {
    return new Promise((resolve) => {
        if (!widgetId || !relatedMessageId || !userId) return resolve(false);

        db.run(
            `UPDATE saved_widgets SET related_message_id = ? WHERE id = ? AND user_id = ?`,
            [relatedMessageId, widgetId, userId],
            function (err) {
                if (err) {
                    console.error("[WidgetRepo] Error updating related_message_id:", err.message);
                    return resolve(false);
                }
                resolve(this.changes > 0);
            }
        );
    });
}

/**
 * Toggles the pinned status of a saved widget.
 * 
 * @param {number} id - Widget ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if updated successfully
 */
function togglePinWidget(id, userId) {
    return new Promise((resolve) => {
        if (!id || !userId) return resolve(false);

        db.run(
            `UPDATE saved_widgets 
             SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END 
             WHERE id = ? AND user_id = ?`,
            [id, userId],
            function (err) {
                if (err) {
                    console.error("[WidgetRepo] Error toggling pin:", err.message);
                    return resolve(false);
                }
                resolve(this.changes > 0);
            }
        );
    });
}

/**
 * Deletes a saved widget by ID and user ownership.
 * 
 * @param {number} id - Widget ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
function deleteWidget(id, userId) {
    return new Promise((resolve) => {
        if (!id || !userId) return resolve(false);

        db.run(
            `DELETE FROM saved_widgets WHERE id = ? AND user_id = ?`,
            [id, userId],
            function (err) {
                if (err) {
                    console.error("[WidgetRepo] Error deleting widget:", err.message);
                    return resolve(false);
                }
                resolve(this.changes > 0);
            }
        );
    });
}

module.exports = {
    saveWidget,
    getUserWidgets,
    getWidgetById,
    updateRelatedMessageId,
    togglePinWidget,
    deleteWidget
};
