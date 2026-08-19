// server.js
/**
 * Application Bootstrap
 * Initializes Express, core middlewares, RAG service, database connection, and mounts the central router.
 */

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

// Initialize central database connection & schema
require("./db");

// Start Python RAG retrieval service
const { startRagService } = require("./rag/ragManager");
startRagService();

const app = express();
const PORT = process.env.PORT || 3000;

// Core Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Central Routes Hub
const routes = require("./routes");
app.use("/", routes);

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
