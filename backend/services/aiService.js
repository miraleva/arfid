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

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

/**
 * Sends a text prompt or content structure to Google Gemini model and returns the raw response text.
 * 
 * @param {string|Array} contents - Prompt text or array of content parts
 * @param {Object} [config={}] - Optional model configuration (JSON schema, tools, etc.)
 * @returns {Promise<string>} Model output text
 */
async function geminiResponse(contents, config = {}) {
    let attempts = 0;
    const maxAttempts = 3;
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
            if (attempts < maxAttempts && (error.status === 503 || error.status === 429)) {
                const previousModel = activeModel;
                activeModel = activeModel === DEFAULT_MODEL ? FALLBACK_MODEL : DEFAULT_MODEL;
                console.warn(`\n⚠️  [AI SERVICE FALLBACK] Gemini HTTP ${error.status} alındı (Deneme ${attempts}/${maxAttempts})!`);
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
    const maxAttempts = 3;
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
            if (attempts < maxAttempts && (error.status === 503 || error.status === 429)) {
                const previousModel = activeModel;
                activeModel = activeModel === DEFAULT_MODEL ? FALLBACK_MODEL : DEFAULT_MODEL;
                console.warn(`\n⚠️  [AI SERVICE FALLBACK] Gemini Raw Call HTTP ${error.status} alındı (Deneme ${attempts}/${maxAttempts})!`);
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
