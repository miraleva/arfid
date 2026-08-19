/**
 * Central Router
 * Aggregates and mounts all route modules (Auth, Chat, Dev) for the ARFID backend.
 */

const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const chatRoutes = require("./chatRoutes");
const devRoutes = require("./devRoutes");

// Mount sub-routers
router.use("/", authRoutes);
router.use("/", chatRoutes);
router.use("/", devRoutes);

/**
 * Route: Healthcheck root endpoint.
 * Path: GET /
 */
router.get("/", (req, res) => {
    res.send("ARFID Backend API çalışıyor 🚀");
});

module.exports = router;
