/**
 * Dev Controller
 * Handles HTTP requests and responses for internal developer and testing endpoints.
 */

const { geminiResponse } = require("../services/aiService");
const { getDietitianResponse } = require("../services/dietitianService");

/**
 * Handles raw AI search queries for debugging.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function handleDevSearch(req, res) {
    try {
        const userText = req.query.query;
        const response = await geminiResponse(userText);
        res.send(response);
    } catch (error) {
        console.error("[DEV] aiSearch Error:", error.message);
        res.status(500).send("AI Search is temporarily unavailable. Please try again later.");
    }
}

/**
 * Handles dietician queries in test/guest mode for debugging.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function handleDevAsist(req, res) {
    try {
        const userText = req.query.query;
        const response = await getDietitianResponse(userText);
        res.send(response);
    } catch (error) {
        console.error("[DEV] aiAsist Error:", error.message);
        res.status(500).send("AI Assistant is temporarily unavailable. Please try again later.");
    }
}

module.exports = {
    handleDevSearch,
    handleDevAsist
};
