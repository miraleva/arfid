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

/**
 * Retrieves chat history for the authenticated user.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function getHistory(req, res) {
    try {
        const userId = req.get('X-User-Id');
        if (!userId) {
            return res.json({ messages: [] });
        }

        const messages = await chatRepository.getUserChatHistory(userId, 200);
        res.json({ messages });
    } catch (error) {
        console.error("Get chat history error:", error);
        res.status(500).json({ error: "Geçmiş sohbetler alınamadı", messages: [] });
    }
}

/**
 * Deletes a list of messages belonging to a chat session.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function deleteSession(req, res) {
    try {
        const userId = req.get('X-User-Id');
        const { messageIds } = req.body;

        if (!userId || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await chatRepository.deleteMessagesByIds(userId, messageIds);
        res.json({ success });
    } catch (error) {
        console.error("Delete session error:", error);
        res.status(500).json({ success: false, error: "Sohbet silinirken hata oluştu" });
    }
}

module.exports = {
    handleChat,
    getHistory,
    deleteSession
};
