/**
 * Auth Routes
 * Defines HTTP endpoints for user registration (/signup) and authentication (/signin).
 * Protected by internal proxy authentication middleware.
 */

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyInternalToken } = require("../middleware/internalAuth");

/**
 * Route: User registration
 * Path: POST /signup
 */
router.post("/signup", verifyInternalToken, authController.signup);

/**
 * Route: User login
 * Path: POST /signin
 */
router.post("/signin", verifyInternalToken, authController.signin);

module.exports = router;
