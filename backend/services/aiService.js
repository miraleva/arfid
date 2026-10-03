/**
 * AI Service
 * Low-level wrapper around the Google Gemini Generative AI SDK (@google/genai).
 * Supports direct generation, structured output, and multi-turn tool calling.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { GoogleGenAI } = require("@google/genai");

const apiKey = (process.env.GOOGLE_API_KEY || "").trim();
const ai = new GoogleGenAI({ apiKey: apiKey || undefined });

const MODEL_CASCADE = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
];

const DEFAULT_MODEL = MODEL_CASCADE[0];

/**
 * Determines whether a Gemini API error is transient and can be retried with the next fallback model.
 * Handles HTTP 503, 429, 500, 502, 504 as well as Node.js / undici network level 'fetch failed' errors.
 * 
 * @param {any} error 
 * @returns {boolean}
 */
function isRetryableError(error) {
    if (!error) return false;

    // 1. HTTP Status Codes
    const retryableStatuses = [429, 500, 502, 503, 504];
    if (retryableStatuses.includes(error.status)) return true;

    // 2. Fetch / Network level exceptions (undici / Node.js)
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("timeout") || msg.includes("econnreset")) {
        return true;
    }

    // 3. Nested cause codes
    const code = error.code || (error.cause && error.cause.code);
    const networkCodes = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"];
    if (code && networkCodes.includes(code)) {
        return true;
    }

    return false;
}

/**
 * Gets the next fallback model in the cascade given the current active model.
 * 
 * @param {string} currentModel 
 * @returns {string} Next model in cascade
 */
function getNextFallbackModel(currentModel) {
    const idx = MODEL_CASCADE.indexOf(currentModel);
    if (idx !== -1 && idx + 1 < MODEL_CASCADE.length) {
        return MODEL_CASCADE[idx + 1];
    }
    // If reached the end of list, cycle back to the lightest model or start
    return MODEL_CASCADE[MODEL_CASCADE.length - 1];
}

/**
 * Sends a text prompt or content structure to Google Gemini model and returns the raw response text.
 * 
 * @param {string|Array} contents - Prompt text or array of content parts
 * @param {Object} [config={}] - Optional model configuration (JSON schema, tools, etc.)
 * @returns {Promise<string>} Model output text
 */
async function geminiResponse(contents, config = {}) {
    let attempts = 0;
    const maxAttempts = MODEL_CASCADE.length;
    let activeModel = config.model || DEFAULT_MODEL;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: contents,
                config: config
            });
            return response.text || "";
        } catch (error) {
            if (attempts < maxAttempts && isRetryableError(error)) {
                const previousModel = activeModel;
                activeModel = getNextFallbackModel(previousModel);
                const reason = error.status ? `HTTP ${error.status}` : (error.message || "Ağ Hatası");
                console.warn(`\n⚠️  [AI SERVICE FALLBACK] Gemini Hatası [${reason}] alındı (Deneme ${attempts}/${maxAttempts})!`);
                console.warn(`   Model otomatik olarak devrediliyor: [${previousModel}] ➔ [${activeModel}] (${attempts}s sonra yeniden denenecek)...\n`);
                await new Promise(r => setTimeout(r, 1000 * attempts));
                continue;
            }
            console.error("Gemini Response Error:", error);
            throw error;
        }
    }
}

/**
 * Sends contents to Google Gemini with tools and returns the complete response object
 * (including potential functionCalls).
 * 
 * @param {string|Array} contents - Prompt text or content objects
 * @param {Object} [config={}] - Model configuration (including tools)
 * @returns {Promise<any>} Raw Gemini response object
 */
async function geminiRawCall(contents, config = {}) {
    let attempts = 0;
    const maxAttempts = MODEL_CASCADE.length;
    let activeModel = config.model || DEFAULT_MODEL;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: contents,
                config: config
            });
            return response;
        } catch (error) {
            if (attempts < maxAttempts && isRetryableError(error)) {
                const previousModel = activeModel;
                activeModel = getNextFallbackModel(previousModel);
                const reason = error.status ? `HTTP ${error.status}` : (error.message || "Ağ Hatası");
                console.warn(`\n⚠️  [AI SERVICE FALLBACK] Gemini Raw Call Hatası [${reason}] alındı (Deneme ${attempts}/${maxAttempts})!`);
                console.warn(`   Model otomatik olarak devrediliyor: [${previousModel}] ➔ [${activeModel}] (${attempts}s sonra yeniden denenecek)...\n`);
                await new Promise(r => setTimeout(r, 1000 * attempts));
                continue;
            }
            console.error("Gemini Raw Call Error:", error);
            throw error;
        }
    }
}

module.exports = {
    geminiResponse,
    geminiRawCall
};
