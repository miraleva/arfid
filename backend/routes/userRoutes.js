/**
 * User Routes
 * Defines HTTP endpoints for user dietary profile management.
 * Protected by internal proxy authentication middleware.
 */

const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyInternalToken } = require("../middleware/internalAuth");

/**
 * Route: Get full dietary profile (safe/unsafe foods + sensory triggers)
 * Path: GET /user/dietary-profile
 */
router.get("/user/dietary-profile", verifyInternalToken, userController.getDietaryProfile);

/**
 * Route: Delete specific food preference
 * Path: DELETE /user/dietary-profile/food/:foodId
 */
router.delete("/user/dietary-profile/food/:foodId", verifyInternalToken, userController.deleteFoodPreference);

/**
 * Route: Delete specific sensory trigger
 * Path: DELETE /user/dietary-profile/sensory/:attributeId
 */
router.delete("/user/dietary-profile/sensory/:attributeId", verifyInternalToken, userController.deleteSensoryTrigger);

module.exports = router;
