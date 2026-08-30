/**
 * AI Service
 * Low-level wrapper around the Google Gemini Generative AI SDK (@google/genai).
 * Supports direct generation, structured output, and multi-turn tool calling.
 */

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

/**
 * Sends a text prompt or content structure to Google Gemini model and returns the raw response text.
 * 
 * @param {string|Array} contents - Prompt text or array of content parts
 * @param {Object} [config={}] - Optional model configuration (JSON schema, tools, etc.)
 * @returns {Promise<string>} Model output text
 */
async function geminiResponse(contents, config = {}) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: contents,
            config: config
        });
        return response.text || "";
    } catch (error) {
        console.error("Gemini Response Error:", error);
        throw error;
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
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: contents,
            config: config
        });
        return response;
    } catch (error) {
        console.error("Gemini Raw Call Error:", error);
        throw error;
    }
}

module.exports = {
    geminiResponse,
    geminiRawCall
};
