/**
 * Chat Repository
 * Handles all direct SQLite database queries for conversations, chat messages, and session lifecycle.
 */

const db = require("../db");

/**
 * Creates a new conversation session for a user.
 * 
 * @param {number} userId - User ID
 * @param {string} title - Conversation title (derived from first message or custom)
 * @returns {Promise<Object>} Created conversation record
 */
function createConversation(userId, title = "Yeni Sohbet") {
    return new Promise((resolve, reject) => {
        if (!userId) return reject(new Error("userId is required"));

        const now = Math.floor(Date.now() / 1000);
        const cleanTitle = (title || "Yeni Sohbet").trim();

        db.run(
            `INSERT INTO conversations (user_id, title, created_at, updated_at, is_pinned)
             VALUES (?, ?, ?, ?, 0)`,
            [userId, cleanTitle, now, now],
            function (err) {
                if (err) {
                    console.error("[ChatRepo] Create conversation failed:", err.message);
                    return reject(err);
                }
                resolve({
                    id: this.lastID,
                    userId,
                    user_id: userId,
                    title: cleanTitle,
                    createdAt: now,
                    created_at: now,
                    updatedAt: now,
                    updated_at: now,
                    isPinned: 0,
                    is_pinned: 0
                });
            }
        );
    });
}

/**
 * Saves a message attached to a specific conversation and touches updated_at.
 * 
 * @param {number} userId - Target user ID
 * @param {number} conversationId - Parent conversation ID
 * @param {'user' | 'assistant'} role - Message sender role
 * @param {string} content - Message text
 * @returns {Promise<number|void>} Last inserted message ID
 */
async function saveMessage(userId, conversationId, role, content) {
    if (!userId) return;

    const createdAt = Math.floor(Date.now() / 1000);

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO chat_messages (user_id, conversation_id, role, content, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, conversationId || null, role, content, createdAt],
            function (err) {
                if (err) {
                    console.error("[ChatRepo] Save message failed:", err.message);
                    return resolve(); // Graceful fallback
                }

                const insertedId = this.lastID;

                // Touch updated_at on parent conversation
                if (conversationId) {
                    db.run(
                        `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`,
                        [createdAt, conversationId, userId],
                        (updateErr) => {
                            if (updateErr) {
                                console.warn("[ChatRepo] Failed to update conversation updated_at:", updateErr.message);
                            }
                            resolve(insertedId);
                        }
                    );
                } else {
                    resolve(insertedId);
                }
            }
        );
    });
}

/**
 * Retrieves the last N messages of a SPECIFIC conversation, ordered chronologically.
 * Used exclusively for LLM recent chat context without leaking other conversations.
 * 
 * @param {number} conversationId - Target conversation ID
 * @param {number} [limit=10] - Max messages to retrieve
 * @returns {Promise<Array<{ role: 'user' | 'assistant', content: string }>>}
 */
function getRecentMessages(conversationId, limit = 10) {
    return new Promise((resolve) => {
        if (!conversationId) return resolve([]);

        db.all(
            `SELECT role, content FROM (
                SELECT role, content, id 
                FROM chat_messages 
                WHERE conversation_id = ? 
                ORDER BY id DESC 
                LIMIT ?
            ) ORDER BY id ASC`,
            [conversationId, limit],
            (err, rows) => {
                if (err) {
                    console.error("[ChatRepo] Get recent messages failed:", err.message);
                    return resolve([]);
                }
                resolve(rows || []);
            }
        );
    });
}

/**
 * Retrieves all conversations belonging to a user, ordered by pinned first then newest activity.
 * 
 * @param {number} userId - Target user ID
 * @returns {Promise<Array<Object>>}
 */
function getUserConversations(userId) {
    return new Promise((resolve) => {
        if (!userId) return resolve([]);

        db.all(
            `SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at, c.is_pinned,
                    COUNT(cm.id) as message_count
             FROM conversations c
             LEFT JOIN chat_messages cm ON cm.conversation_id = c.id
             WHERE c.user_id = ?
             GROUP BY c.id
             ORDER BY c.is_pinned DESC, c.updated_at DESC`,
            [userId],
            (err, rows) => {
                if (err) {
                    console.error("[ChatRepo] Get user conversations failed:", err.message);
                    return resolve([]);
                }
                resolve(rows || []);
            }
        );
    });
}

/**
 * Retrieves all messages belonging to a specific conversation with user ownership check.
 * 
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID
 * @returns {Promise<Array<Object>>}
 */
function getConversationMessages(conversationId, userId) {
    return new Promise((resolve) => {
        if (!conversationId || !userId) return resolve([]);

        db.all(
            `SELECT cm.id, cm.role, cm.content, cm.created_at, cm.conversation_id,
                    sw.id AS widget_id, sw.widget_type, sw.title AS widget_title, sw.widget_data
             FROM chat_messages cm
             JOIN conversations c ON c.id = cm.conversation_id
             LEFT JOIN (
                 SELECT id, related_message_id, user_id, widget_type, title, widget_data, MAX(id)
                 FROM saved_widgets
                 WHERE related_message_id IS NOT NULL
                 GROUP BY related_message_id
             ) sw ON sw.related_message_id = cm.id AND sw.user_id = cm.user_id
             WHERE cm.conversation_id = ? AND c.user_id = ?
             ORDER BY cm.id ASC`,
            [conversationId, userId],
            (err, rows) => {
                if (err) {
                    console.error("[ChatRepo] Get conversation messages failed:", err.message);
                    return resolve([]);
                }
                const messages = (rows || []).map(row => {
                    let widget = null;
                    if (row.widget_data) {
                        try {
                            const parsed = typeof row.widget_data === "string" ? JSON.parse(row.widget_data) : row.widget_data;
                            if (parsed && typeof parsed === 'object') {
                                widget = {
                                    id: row.widget_id || parsed.id,
                                    type: row.widget_type || parsed.type || 'recipe',
                                    title: row.widget_title || parsed.title || 'Bilgi Kartı',
                                    data: parsed.data ? parsed.data : parsed
                                };
                            }
                        } catch (parseErr) {
                            console.error("[ChatRepo] Failed to parse widget_data for message", row.id, parseErr.message);
                        }
                    }
                    return {
                        id: row.id,
                        role: row.role,
                        content: row.content,
                        created_at: row.created_at,
                        conversation_id: row.conversation_id,
                        widget
                    };
                });
                resolve(messages);
            }
        );
    });
}

/**
 * Renames an existing conversation title.
 * 
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID
 * @param {string} title - New title
 * @returns {Promise<boolean>}
 */
function renameConversation(conversationId, userId, title) {
    return new Promise((resolve) => {
        if (!conversationId || !userId || !title) return resolve(false);

        db.run(
            `UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?`,
            [title.trim(), conversationId, userId],
            function (err) {
                if (err) {
                    console.error("[ChatRepo] Rename conversation failed:", err.message);
                    return resolve(false);
                }
                resolve(this.changes > 0);
            }
        );
    });
}

/**
 * Toggles the pinned status of a conversation.
 * 
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
function togglePinConversation(conversationId, userId) {
    return new Promise((resolve) => {
        if (!conversationId || !userId) return resolve(false);

        db.run(
            `UPDATE conversations 
             SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END 
             WHERE id = ? AND user_id = ?`,
            [conversationId, userId],
            function (err) {
                if (err) {
                    console.error("[ChatRepo] Toggle pin conversation failed:", err.message);
                    return resolve(false);
                }
                resolve(this.changes > 0);
            }
        );
    });
}

/**
 * Deletes a conversation and cascades message deletion via SQLite.
 * 
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
function deleteConversation(conversationId, userId) {
    return new Promise((resolve) => {
        if (!conversationId || !userId) return resolve(false);

        db.run(
            `DELETE FROM conversations WHERE id = ? AND user_id = ?`,
            [conversationId, userId],
            function (err) {
                if (err) {
                    console.error("[ChatRepo] Delete conversation failed:", err.message);
                    return resolve(false);
                }
                resolve(this.changes > 0);
            }
        );
    });
}

/**
 * Backward compatibility: Deletes messages by IDs.
 */
function deleteMessagesByIds(userId, messageIds) {
    return new Promise((resolve) => {
        if (!userId || !Array.isArray(messageIds) || messageIds.length === 0) {
            return resolve(false);
        }

        const placeholders = messageIds.map(() => '?').join(',');
        const query = `DELETE FROM chat_messages WHERE user_id = ? AND id IN (${placeholders})`;
        const params = [userId, ...messageIds];

        db.run(query, params, function (err) {
            if (err) {
                console.error("[ChatRepo] Delete messages failed:", err.message);
                return resolve(false);
            }
            resolve(true);
        });
    });
}

module.exports = {
    createConversation,
    saveMessage,
    getRecentMessages,
    getUserConversations,
    getConversationMessages,
    renameConversation,
    togglePinConversation,
    deleteConversation,
    deleteMessagesByIds
};
