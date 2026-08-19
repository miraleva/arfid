/**
 * Chat Controller
 * Handles HTTP requests and responses for the dietitian chat interaction.
 */

const dietitianService = require("../services/dietitianService");
const chatRepository = require("../repositories/chatRepository");

/**
 * Handles incoming chat messages from users or guests.
 * Saves user messages, coordinates AI response and patient card generation, and saves assistant responses.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function handleChat(req, res) {
    try {
        const { message } = req.body;
        // Trusted Identity from Header (set by Frontend Proxy)
        const userId = req.get('X-User-Id');

        console.log(`Chat message from User[${userId || 'Guest'}]:`, message);

        // A) Save User Message
        if (userId) {
            await chatRepository.saveMessage(userId, 'user', message);
        }

        const { assistant_response, patient_card } = await dietitianService.getDietitianResponse(message, userId);

        // B) Save Assistant Response
        if (userId && assistant_response) {
            await chatRepository.saveMessage(userId, 'assistant', assistant_response);
        }

        res.json({
            response: assistant_response,
            patient_card: patient_card
        });
    } catch (error) {
        console.error("Chat route crash prevented:", error);
        res.status(500).json({ response: "Üzgünüm, şu an bir hata oluştu. Daha sonra tekrar deneyebilir misiniz?" });
    }
}

module.exports = {
    handleChat
};
