/**
 * Chat Controller
 * Handles HTTP requests and responses for the dietitian chat interaction and conversation lifecycle.
 */

const dietitianService = require("../services/dietitianService");
const chatRepository = require("../repositories/chatRepository");
const widgetRepository = require("../repositories/widgetRepository");

/**
 * Handles incoming chat messages from users or guests.
 * Supports Lazy Conversation Creation on first user message.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function handleChat(req, res) {
    try {
        const { message, conversationId } = req.body;
        // Trusted Identity from Header (set by Frontend Proxy)
        const userId = req.get('X-User-Id');

        console.log(`Chat message from User[${userId || 'Guest'}], Conv[${conversationId || 'New'}]:`, message);

        let activeConvId = conversationId ? Number(conversationId) : null;
        let convTitle = null;

        // A) Lazy Conversation Creation: If logged in and no conversationId provided, create a new one
        if (userId && !activeConvId) {
            const rawTitle = (message || "Yeni Sohbet").trim();
            convTitle = rawTitle.length > 45 ? rawTitle.substring(0, 45) + "..." : rawTitle;
            const newConv = await chatRepository.createConversation(userId, convTitle);
            activeConvId = newConv.id;
            console.log(`[Chat Controller] Created new conversation ${activeConvId} for User ${userId}`);
        }

        // B) Save User Message attached to conversation
        if (userId) {
            await chatRepository.saveMessage(userId, activeConvId, 'user', message);
        }

        // C) Get AI Dietitian Response (Scoped with activeConvId)
        const { assistant_response, patient_card, widget } = await dietitianService.getDietitianResponse(
            message,
            userId,
            activeConvId
        );

        // D) Save Assistant Response attached to conversation
        let assistantMessageId = null;
        if (userId && assistant_response) {
            assistantMessageId = await chatRepository.saveMessage(userId, activeConvId, 'assistant', assistant_response);
        }

        // E) Save Widget with Related Message Link, Conversation Link, and Duplicate Protection
        let savedWidget = null;
        if (userId && widget) {
            try {
                savedWidget = await widgetRepository.saveWidget(
                    userId,
                    widget.type,
                    widget.title,
                    widget,
                    assistantMessageId,
                    activeConvId
                );
            } catch (widgetErr) {
                console.error("Widget auto-save failed, continuing:", widgetErr.message);
            }
        }

        res.json({
            response: assistant_response,
            patient_card: patient_card,
            widget: widget,
            conversation_id: activeConvId,
            conversation_title: convTitle,
            saved_widget_id: savedWidget ? savedWidget.id : null
        });
    } catch (error) {
        console.error("Chat route crash prevented:", error);
        res.status(500).json({ response: "Üzgünüm, şu an bir hata oluştu. Daha sonra tekrar deneyebilir misiniz?" });
    }
}

/**
 * Retrieves all conversations for the authenticated user (Sidebar list).
 */
async function getConversations(req, res) {
    try {
        const userId = req.get('X-User-Id');
        if (!userId) {
            return res.json({ conversations: [] });
        }

        const conversations = await chatRepository.getUserConversations(userId);
        res.json({ conversations });
    } catch (error) {
        console.error("Get conversations error:", error);
        res.status(500).json({ error: "Sohbet oturumları alınamadı", conversations: [] });
    }
}

/**
 * Retrieves all messages belonging to a specific conversation.
 */
async function getConversationMessages(req, res) {
    try {
        const userId = req.get('X-User-Id');
        const conversationId = Number(req.params.id);

        if (!userId || !conversationId) {
            return res.json({ messages: [] });
        }

        const messages = await chatRepository.getConversationMessages(conversationId, userId);
        res.json({ messages });
    } catch (error) {
        console.error("Get conversation messages error:", error);
        res.status(500).json({ error: "Sohbet mesajları alınamadı", messages: [] });
    }
}

/**
 * Renames a conversation.
 */
async function renameConversation(req, res) {
    try {
        const userId = req.get('X-User-Id');
        const conversationId = Number(req.params.id);
        const { title } = req.body;

        if (!userId || !conversationId || !title) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await chatRepository.renameConversation(conversationId, userId, title);
        res.json({ success });
    } catch (error) {
        console.error("Rename conversation error:", error);
        res.status(500).json({ success: false, error: "Yeniden adlandırma başarısız" });
    }
}

/**
 * Toggles pinned status for a conversation.
 */
async function togglePinConversation(req, res) {
    try {
        const userId = req.get('X-User-Id');
        const conversationId = Number(req.params.id);

        if (!userId || !conversationId) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await chatRepository.togglePinConversation(conversationId, userId);
        res.json({ success });
    } catch (error) {
        console.error("Toggle pin conversation error:", error);
        res.status(500).json({ success: false, error: "Sabitleme durumu değiştirilemedi" });
    }
}

/**
 * Deletes an entire conversation session and all its messages.
 */
async function deleteConversation(req, res) {
    try {
        const userId = req.get('X-User-Id');
        const conversationId = Number(req.params.id);

        if (!userId || !conversationId) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await chatRepository.deleteConversation(conversationId, userId);
        res.json({ success });
    } catch (error) {
        console.error("Delete conversation error:", error);
        res.status(500).json({ success: false, error: "Sohbet silinemedi" });
    }
}

/**
 * Backward compatibility: Retrieves chat history for the authenticated user.
 */
async function getHistory(req, res) {
    try {
        const userId = req.get('X-User-Id');
        if (!userId) {
            return res.json({ messages: [] });
        }

        const conversations = await chatRepository.getUserConversations(userId);
        res.json({ conversations, messages: [] });
    } catch (error) {
        console.error("Get chat history error:", error);
        res.status(500).json({ error: "Geçmiş sohbetler alınamadı", messages: [] });
    }
}

/**
 * Backward compatibility: Deletes a list of messages.
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

/**
 * Retrieves all saved widgets (recipes and nutrition cards) for the user.
 */
async function getSavedWidgets(req, res) {
    try {
        const userId = req.get('X-User-Id');
        if (!userId) {
            return res.json({ widgets: [] });
        }

        const widgets = await widgetRepository.getUserWidgets(userId, 100);
        res.json({ widgets });
    } catch (error) {
        console.error("Get saved widgets error:", error);
        res.status(500).json({ widgets: [], error: "Kayıtlı tarifler alınamadı" });
    }
}

/**
 * Toggles pinned status for a saved widget.
 */
async function togglePinWidget(req, res) {
    try {
        const userId = req.get('X-User-Id');
        const widgetId = Number(req.params.id);

        if (!userId || !widgetId) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await widgetRepository.togglePinWidget(widgetId, userId);
        res.json({ success });
    } catch (error) {
        console.error("Toggle pin widget error:", error);
        res.status(500).json({ success: false, error: "Tarif sabitleme durumu değiştirilemedi" });
    }
}

/**
 * Deletes a saved widget.
 */
async function deleteWidget(req, res) {
    try {
        const userId = req.get('X-User-Id');
        const widgetId = Number(req.params.id);

        if (!userId || !widgetId) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await widgetRepository.deleteWidget(widgetId, userId);
        res.json({ success });
    } catch (error) {
        console.error("Delete widget error:", error);
        res.status(500).json({ success: false, error: "Tarif silinemedi" });
    }
}

module.exports = {
    handleChat,
    getConversations,
    getConversationMessages,
    renameConversation,
    togglePinConversation,
    deleteConversation,
    getSavedWidgets,
    togglePinWidget,
    deleteWidget,
    getHistory,
    deleteSession
};

