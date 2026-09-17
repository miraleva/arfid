/**
 * Frontend Backend API Client
 * Centralized HTTP communication with the backend service.
 * Handles base URL configuration, internal proxy tokens, JSON payload serialization, and normalized error handling.
 */

require("dotenv").config();

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:3000";
const INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET;

/**
 * Generic core fetch helper for backend requests.
 * 
 * @param {string} endpoint - API path (e.g. '/signin')
 * @param {string} [method="POST"] - HTTP method
 * @param {Object|null} [body=null] - Payload object to serialize as JSON
 * @param {Object} [extraHeaders={}] - Additional headers (e.g. X-User-Id)
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function requestBackend(endpoint, method = "POST", body = null, extraHeaders = {}) {
    const headers = {
        "Content-Type": "application/json",
        "X-Internal-Token": INTERNAL_SHARED_SECRET,
        ...extraHeaders
    };

    const options = {
        method,
        headers
    };

    if (body !== null && method !== "GET" && method !== "HEAD") {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${BACKEND_API_URL}${endpoint}`, options);
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { error: "Geçersiz yanıt formatı" };
        }

        return {
            ok: response.ok,
            status: response.status,
            data
        };
    } catch (err) {
        return {
            ok: false,
            status: 500,
            data: { error: err.message || "Bağlantı hatası" }
        };
    }
}

async function callBackend(endpoint, body, extraHeaders = {}) {
    return requestBackend(endpoint, "POST", body, extraHeaders);
}

/**
 * Sends a signin request to the backend.
 * 
 * @param {string} email - User email address
 * @param {string} password - User password
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function signin(email, password) {
    return callBackend("/signin", { email, password });
}

/**
 * Sends a signup request to the backend.
 * 
 * @param {string} email - User email address
 * @param {string} password - User password
 * @param {string} username - User username
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function signup(email, password, username) {
    return callBackend("/signup", { email, password, username });
}

/**
 * Sends a chat message to the backend with trusted user ID header and optional conversation ID.
 * 
 * @param {string} message - User message text
 * @param {number|string|null} [userId=null] - Authenticated user ID
 * @param {number|string|null} [conversationId=null] - Active conversation ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function sendChatMessage(message, userId = null, conversationId = null) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return callBackend("/chat", { message, conversationId }, extraHeaders);
}

/**
 * Retrieves all conversations for the user.
 * 
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function getConversations(userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend("/chat/conversations", "GET", null, extraHeaders);
}

/**
 * Retrieves all messages for a specific conversation.
 * 
 * @param {number|string} conversationId - Conversation ID
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function getConversationMessages(conversationId, userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend(`/chat/conversations/${conversationId}/messages`, "GET", null, extraHeaders);
}

/**
 * Renames a conversation.
 * 
 * @param {number|string} conversationId - Conversation ID
 * @param {string} title - New title
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function renameConversation(conversationId, title, userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend(`/chat/conversations/${conversationId}/rename`, "PATCH", { title }, extraHeaders);
}

/**
 * Toggles pin status of a conversation.
 * 
 * @param {number|string} conversationId - Conversation ID
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function togglePinConversation(conversationId, userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend(`/chat/conversations/${conversationId}/pin`, "PATCH", null, extraHeaders);
}

/**
 * Deletes an entire conversation.
 * 
 * @param {number|string} conversationId - Conversation ID
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function deleteConversation(conversationId, userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend(`/chat/conversations/${conversationId}`, "DELETE", null, extraHeaders);
}

/**
 * Backward compatibility: Retrieves chat history from the backend.
 * 
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function getChatHistory(userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend("/chat/history", "GET", null, extraHeaders);
}

/**
 * Backward compatibility: Sends a request to delete messages in a session.
 * 
 * @param {number[]} messageIds - Array of message IDs to delete
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function deleteChatSession(messageIds, userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend("/chat/session", "DELETE", { messageIds }, extraHeaders);
}

/**
 * Retrieves all saved widgets (recipes and nutrition cards) for the user.
 * 
 * @param {number|string} userId - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function getSavedWidgets(userId) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return requestBackend("/widgets/saved", "GET", null, extraHeaders);
}

module.exports = {
    signin,
    signup,
    sendChatMessage,
    getConversations,
    getConversationMessages,
    renameConversation,
    togglePinConversation,
    deleteConversation,
    getSavedWidgets,
    getChatHistory,
    deleteChatSession,
    callBackend,
    requestBackend
};


