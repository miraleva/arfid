/**
 * Chat Routes
 * Defines HTTP endpoints for dietitian chat interactions.
 * Protected by internal proxy authentication middleware.
 */

const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { verifyInternalToken } = require("../middleware/internalAuth");

/**
 * Route: Main chat interaction endpoint
 * Path: POST /chat
 */
router.post("/chat", verifyInternalToken, chatController.handleChat);

/**
 * Conversation Lifecycle Endpoints
 */
router.get("/chat/conversations", verifyInternalToken, chatController.getConversations);
router.get("/chat/conversations/:id/messages", verifyInternalToken, chatController.getConversationMessages);
router.patch("/chat/conversations/:id/rename", verifyInternalToken, chatController.renameConversation);
router.patch("/chat/conversations/:id/pin", verifyInternalToken, chatController.togglePinConversation);
router.delete("/chat/conversations/:id", verifyInternalToken, chatController.deleteConversation);

/**
 * Saved Widgets (Tariflerim & Besin Değerleri) Endpoints
 */
router.get("/widgets/saved", verifyInternalToken, chatController.getSavedWidgets);
router.patch("/widgets/saved/:id/pin", verifyInternalToken, chatController.togglePinWidget);
router.delete("/widgets/saved/:id", verifyInternalToken, chatController.deleteWidget);

/**
 * Route: Get user chat history endpoint (legacy compatibility)
 * Path: GET /chat/history
 */
router.get("/chat/history", verifyInternalToken, chatController.getHistory);

/**
 * Route: Delete chat session endpoint (legacy compatibility)
 * Path: DELETE /chat/session
 */
router.delete("/chat/session", verifyInternalToken, chatController.deleteSession);

module.exports = router;

