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
 * @param {Object} body - Payload object to serialize as JSON
 * @param {Object} [extraHeaders={}] - Additional headers (e.g. X-User-Id)
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function callBackend(endpoint, body, extraHeaders = {}) {
    const headers = {
        "Content-Type": "application/json",
        "X-Internal-Token": INTERNAL_SHARED_SECRET,
        ...extraHeaders
    };

    const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });

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
 * Sends a chat message to the backend with trusted user ID header.
 * 
 * @param {string} message - User message text
 * @param {number|string|null} [userId=null] - Authenticated user ID
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function sendChatMessage(message, userId = null) {
    const extraHeaders = userId ? { "X-User-Id": String(userId) } : {};
    return callBackend("/chat", { message }, extraHeaders);
}

module.exports = {
    signin,
    signup,
    sendChatMessage,
    callBackend
};
