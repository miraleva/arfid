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
 * Route: Get user chat history endpoint
 * Path: GET /chat/history
 */
router.get("/chat/history", verifyInternalToken, chatController.getHistory);

/**
 * Route: Delete chat session endpoint
 * Path: DELETE /chat/session
 */
router.delete("/chat/session", verifyInternalToken, chatController.deleteSession);

module.exports = router;
