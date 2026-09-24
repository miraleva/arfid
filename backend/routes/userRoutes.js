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

/**
 * Route: Update user profile (username / email)
 * Path: PUT /user/profile
 */
router.put("/user/profile", verifyInternalToken, userController.updateProfile);

/**
 * Route: Change password
 * Path: PUT /user/password
 */
router.put("/user/password", verifyInternalToken, userController.changePassword);

/**
 * Route: Delete account permanently
 * Path: DELETE /user/account
 */
router.delete("/user/account", verifyInternalToken, userController.deleteAccount);

module.exports = router;
