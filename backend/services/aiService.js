/**
 * AI Service
 * Low-level wrapper around the Google Gemini Generative AI SDK.
 */

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

/**
 * Sends a text prompt to Google Gemini model and returns the raw response text.
 * 
 * @param {string} userText - Prompt or structured text for Gemini
 * @param {Object} [config={}] - Optional model configuration (JSON schema, mimeType, etc.)
 * @returns {Promise<string>} Model output text
 */
async function geminiResponse(userText, config = {}) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: userText,
            config: config
        });
        console.log(response.text);
        return response.text;
    } catch (error) {
        console.error("Gemini Response Error:", error);
        throw error;
    }
}

module.exports = {
    geminiResponse
};
