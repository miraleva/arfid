// server.js
const { GoogleGenAI } = require("@google/genai");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");
require("dotenv").config();
const db = require("./db"); // Central SQLite Database connection
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const app = express();
const memoryOps = require("./memoryOps"); // Import memory operations
const chatHistorian = require("./chatHistorian"); // Import chat history operations
const { buildSystemPrompt, jsonSchemaConfig } = require("./promptBuilder");
const { getRagContext } = require("./rag/ragClient");
const { startRagService } = require("./rag/ragManager");
const PORT = process.env.PORT || 3000;

// RAG Retrieval servisini otomatik başlat
startRagService();




/**
 * Generates a short "Patient Card" summary using a second Gemini call.
 * This runs AFTER memory updates to reflect the latest state.
 * 
 * @param {number} userId - Target user ID
 * @returns {Promise<string>} Short patient card text
 */
async function generatePatientCard(userId) {
    if (!userId) return "";

    try {
        // 1. Re-fetch fresh constraints (including just-added ones)
        const memoryContext = await memoryOps.getUserConstraints(userId);

        if (!memoryContext || memoryContext.trim() === "") {
            return "No specific dietary constraints recorded yet.";
        }

        // 2. Short, strict prompt for summary
        const summaryPrompt = `
        You are summarizing a patient's dietary profile for a quick-view card.
        Based ONLY on the following constraints, create a very short summary (max 400 chars).
        
        CONSTRAINTS:
        ${memoryContext}

        REQUIREMENTS:
        - Bullet points or single paragraph.
        - Mention Unsafe Foods (AVOID), Triggers, and Conditions.
        - Be clinical but clear.
        - NO introductory text.
        `;

        // 3. Call Gemini (Lightweight call)
        const summary = await geminiResponse(summaryPrompt);
        return summary.trim();

    } catch (e) {
        console.error("Patient Card Generation Failed:", e);
        return ""; // Fail gracefully, don't crash chat
    }
}

/**
 * Sends a text prompt to Google Gemini model and returns the raw response text.
 * 
 * @param {string} userText - Prompt or structured text for Gemini
 * @param {Object} [config={}] - Optional model configuration (JSON schema, mimeType, etc.)
 * @returns {Promise<string>} Model output text
 */
async function geminiResponse(userText, config = {}) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: userText,
            config: config
        });
        console.log(response.text);
        return response.text;
    } catch (error) {
        console.error("Gemini Response Error:", error);
        throw error;
    }
}

/**
 * Main coordinator function that processes user messages, queries RAG, 
 * generates structured dietitian responses, and applies memory updates.
 * 
 * @param {string} userText - User message
 * @param {number} [userId] - Optional user ID for logged-in sessions
 * @returns {Promise<import('./types').DietitianResult>}
 */
async function getDietitianResponse(userText, userId) {
    // 1. Fetch User Memory Context & Master Lists for Semantic Mapping
    let memoryContext = "";
    let masterLists = { foods: [], sensory: [], conditions: [] };

    try {
        if (userId) {
            memoryContext = await memoryOps.getUserConstraints(userId);
        }
        masterLists = await memoryOps.getMasterLists();
    } catch (err) {
        console.error("Error fetching context/lists:", err);
    }

    // 1.1 Fetch Recent Chat Context
    let recentChatContext = "";
    if (userId) {
        try {
            const recentMessages = await chatHistorian.getRecentMessages(userId, 10);
            if (recentMessages && recentMessages.length > 0) {
                recentChatContext = "RECENT CHAT (last 10):\n" +
                    recentMessages.map(m => {
                        const content = m.content.length > 300 ? m.content.substring(0, 300) + "..." : m.content;
                        return `${m.role}: ${content}`;
                    }).join("\n");
            }
        } catch (histErr) {
            console.error("Error fetching recent messages:", histErr);
        }
    }

    // 1.2 Fetch RAG Context (Knowledge Base)
    const ragContext = await getRagContext(userText);

    // 2. Construct V2.6 Prompt with Semantic Mapping
    const systemPrompt = buildSystemPrompt({
        userText,
        masterLists,
        memoryContext,
        ragContext,
        recentChatContext
    });

    try {
        // 3. Single Gemini Call with Native JSON Mode
        const rawText = await geminiResponse(systemPrompt, jsonSchemaConfig);

        // 4. Direct JSON Parsing with Defensive Fallback
        let parsedData;
        let isFallback = false;
        try {
            parsedData = JSON.parse(rawText);
        } catch (parseError) {
            console.error("JSON Parse Error on Native Output:", parseError);
            console.log("Raw Gemini Output was:", rawText);
            isFallback = true;
            parsedData = {
                assistant_response: "Üzgünüm, cevabınızı işlerken bir sorun oluştu, tekrar deneyebilir misiniz?",
                memory_updates: { foods: [], sensory: [], conditions: [] }
            };
        }

        // 5. Apply Memory Updates (if valid)
        if (parsedData && parsedData.memory_updates && userId) {
            try {
                await memoryOps.applyMemoryUpdates(userId, parsedData.memory_updates, userText);
            } catch (memErr) {
                console.error("Memory update failed, but continuing:", memErr);
            }
        }

        const assistantResponse = parsedData.assistant_response || "Üzgünüm, cevabınızı işlerken bir sorun oluştu, tekrar deneyebilir misiniz?";

        // 6. Generate Patient Card (Call #2) - Skip if fallback occurred
        let patientCard = "";
        if (userId && !isFallback) {
            patientCard = await generatePatientCard(userId);
        }

        return {
            assistant_response: assistantResponse,
            patient_card: patientCard
        };

    } catch (error) {
        console.error("Dietitian Assistant Error:", error.message);
        let errorMsg = "I'm having trouble connecting to my knowledge base right now. Please try again later.";
        if (error.status === 429) {
            errorMsg = "I'm a bit overwhelmed right now. Please try again in a moment.";
        }
        return {
            assistant_response: errorMsg,
            patient_card: ""
        };
    }
}

/**
 * Middleware: Verifies X-Dev-Token header against DEV_TEST_TOKEN environment variable.
 * Protects internal development and testing endpoints.
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
function checkDevToken(req, res, next) {
    const clientDevToken = req.get("X-Dev-Token");
    const validDevToken = process.env.DEV_TEST_TOKEN;

    if (!validDevToken || !clientDevToken || clientDevToken !== validDevToken) {
        return res.status(401).json({ error: "Dev endpoint access denied: Invalid or missing X-Dev-Token" });
    }
    next();
}

/* ==========================================================================
   DEV / TEST ONLY ENDPOINTS
   Bu endpoint'ler geliştirme ve manuel test amaçlıdır, kullanıcı arayüzünden
   erişilmez ve X-Dev-Token header'ı gerektirir.
   ========================================================================== */

/**
 * Route: Direct AI search endpoint for raw queries (DEV/TEST ONLY).
 * Requires X-Dev-Token header.
 */
app.get("/dev/aiSearch", checkDevToken, async (req, res) => {
    try {
        const userText = req.query.query;
        const response = await geminiResponse(userText);
        res.send(response);
    } catch (error) {
        console.error("[DEV] aiSearch Error:", error.message);
        res.status(500).send("AI Search is temporarily unavailable. Please try again later.");
    }
});

/**
 * Route: Dietitian assistant query endpoint for guest/test searches (DEV/TEST ONLY).
 * Requires X-Dev-Token header.
 */
app.get("/dev/aiAsist", checkDevToken, async (req, res) => {
    try {
        const userText = req.query.query;
        const response = await getDietitianResponse(userText);
        res.send(response);
    } catch (error) {
        console.error("[DEV] aiAsist Error:", error.message);
        res.status(500).send("AI Assistant is temporarily unavailable. Please try again later.");
    }
});

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));


// Security Middleware: Verify Internal Shared Secret
app.use((req, res, next) => {
    // Basic paths check if mostly API or public static
    // For this design, we protect API routes predominantly used by frontend proxy
    if (req.path === "/chat" || req.path === "/signup" || req.path === "/signin") {
        const clientToken = req.get('X-Internal-Token');
        const validToken = process.env.INTERNAL_SHARED_SECRET;

        if (!validToken || clientToken !== validToken) {
            console.log(`[Security] Rejected request to ${req.path} from ${req.ip} - Invalid/Missing Token`);
            return res.status(403).json({ error: "Access Denied: Unauthorized Proxy" });
        }
    }
    next();
});

/**
 * Route: User registration / account creation.
 */
app.post("/signup", (req, res) => {
    const { email, password, username } = req.body;
    console.log("signup isteği geldi");
    if (!email || !password || !username) {
        console.log("bilgi eksik");
        return res.status(400).json({ error: "Email, password and username are required" });
    }
    db.run("INSERT INTO users (email, password, username) VALUES (?, ?, ?)",
        [email, password, username], function (err) {
            if (err) {
                console.log(err.message);
                return res.status(500).json({ error: err.message });
            }
            console.log("kaydedildi");
            res.json({ id: this.lastID, email, username });
        });
});

/**
 * Route: User authentication and credential check.
 */
app.post("/signin", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    db.get("SELECT * FROM users WHERE email = ? AND password = ?",
        [email, password], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) {
                res.json({ id: row.id, email: row.email, username: row.username });
            } else {
                res.status(401).json({ error: "Invalid email or password" });
            }
        });
});

/**
 * Route: Main chat endpoint for Dietitian conversational flow and patient card updates.
 */
app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;
        // Trusted Identity from Header (set by Frontend Proxy)
        const userId = req.get('X-User-Id');

        console.log(`Chat message from User[${userId || 'Guest'}]:`, message);

        // A) Save User Message
        if (userId) {
            await chatHistorian.saveMessage(userId, 'user', message);
        }

        const { assistant_response, patient_card } = await getDietitianResponse(message, userId);

        // B) Save Assistant Response
        if (userId && assistant_response) {
            await chatHistorian.saveMessage(userId, 'assistant', assistant_response);
        }

        res.json({
            response: assistant_response,
            patient_card: patient_card
        });
    } catch (error) {
        console.error("Chat route crash prevented:", error);
        res.status(500).json({ response: "Üzgünüm, şu an bir hata oluştu. Daha sonra tekrar deneyebilir misiniz?" });
    }
});

/**
 * Route: Healthcheck root endpoint.
 */
app.get("/", (req, res) => {
    res.send("ARFID Backend API çalışıyor 🚀");
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
