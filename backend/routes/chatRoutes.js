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

module.exports = router;
