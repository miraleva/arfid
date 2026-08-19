/**
 * Dev Routes
 * Internal developer endpoints for debugging and direct AI testing.
 * Protected by X-Dev-Token header check.
 */

const express = require("express");
const router = express.Router();
const devController = require("../controllers/devController");
const { checkDevToken } = require("../middleware/devAuth");

/* ==========================================================================
   DEV / TEST ONLY ENDPOINTS
   Bu endpoint'ler geliştirme ve manuel test amaçlıdır, kullanıcı arayüzünden
   erişilmez ve X-Dev-Token header'ı gerektirir.
   ========================================================================== */

/**
 * Route: Direct AI search endpoint for raw queries (DEV/TEST ONLY).
 * Path: GET /dev/aiSearch
 */
router.get("/dev/aiSearch", checkDevToken, devController.handleDevSearch);

/**
 * Route: Dietitian assistant query endpoint for guest/test searches (DEV/TEST ONLY).
 * Path: GET /dev/aiAsist
 */
router.get("/dev/aiAsist", checkDevToken, devController.handleDevAsist);

module.exports = router;
