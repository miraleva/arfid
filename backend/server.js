// server.js
const { GoogleGenAI } = require("@google/genai");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");
require("dotenv").config();
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const app = express();
const memoryOps = require("./memoryOps"); // Import memory operations
const PORT = 3000;




/**
 * Generates a short "Patient Card" summary using a second Gemini call.
 * This runs AFTER memory updates to reflect the latest state.
 */
async function generatePatientCard(userId) {
    if (!userId) return "";

    try {
        // 1. Re-fetch fresh constraints (including just-added ones)
        const memoryContext = await memoryOps.getUserConstraints(db, userId);

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

async function geminiResponse(userText) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: userText,
        });
        console.log(response.text);
        return response.text;
    } catch (error) {
        console.error("Gemini Response Error:", error);
        throw error;
    }
}
async function getDietitianResponse(userText, userId) {
    // 1. Fetch User Memory Context & Master Lists for Semantic Mapping
    let memoryContext = "";
    let masterLists = { foods: [], sensory: [], conditions: [] };

    try {
        if (userId) {
            memoryContext = await memoryOps.getUserConstraints(db, userId);
        }
        masterLists = await memoryOps.getMasterLists(db);
    } catch (err) {
        console.error("Error fetching context/lists:", err);
    }

    // 2. Construct V2.6 Prompt with Semantic Mapping
    const systemPrompt = `
    You are an expert ARFID Dietitian Assistant.
    Your goal is to provide supportive, safe, and encouraging advice to a user with Avoidant/Restrictive Food Intake Disorder.

    RESPONSE FORMAT INSTRUCTIONS (CRITICAL):
    You must output ONLY valid JSON.
    Do not output markdown code blocks (like \`\`\`json).
    Do not output any text before or after the JSON.
    
    Structure:
    {
      "assistant_response": "Your visible response to the user here.",
      "memory_updates": {
        "foods": [
          { "name": "food_name", "is_safe": 0 or 1 }
        ],
        "sensory": [
          { "name": "attribute_name (e.g., mushy texture)", "is_problematic": 1 }
        ],
        "conditions": [
          { "name": "condition_name (e.g., anxiety)", "has_condition": 1 }
        ]
      }
    }

    MEMORY UPDATE RULES (CONSERVATIVE & SEMANTIC):
    1. SEMANTIC MAPPING (CRITICAL): Before adding any item to 'memory_updates', check the VALID MASTER LISTS below.
       - If the user mentions something that is a synonym, near-match, or the same thing as an item in the master list (e.g., "cocoa" -> "chocolate", "mush mush" -> "mushy texture"), you MUST use the exact name from the master list.
       - If no near-match exists in the list, you may use the user's specific term ONLY if it is a clear food, sensory attribute, or condition.
    2. Only add updates if the user EXPLICITLY states a preference, trigger, or condition about themselves in the CURRENT message.
    3. If the user's message is vague, hypothetical, or just asking a question, return empty arrays for updates.
    4. Max 5 updates per category. Normalize names to lowercase English.
    5. Do NOT hallucinate. Do NOT invent items that are not in the user's message.

    VALID MASTER LISTS (PRIORITIZE THESE NAMES):
    - FOODS: ${masterLists.foods.join(", ")}
    - SENSORY: ${masterLists.sensory.join(", ")}
    - CONDITIONS: ${masterLists.conditions.join(", ")}

    KNOWN USER CONSTRAINTS (RESPECT THESE):
    ${memoryContext ? memoryContext : "None yet."}

    USER MESSAGE:
    "${userText}"
    `;

    try {
        // 3. Single Gemini Call
        const rawText = await geminiResponse(systemPrompt);

        // 4. Robust JSON Parsing (Defensive)
        let parsedDate;
        try {
            // Attempt to find and extract JSON object
            const firstBrace = rawText.indexOf('{');
            const lastBrace = rawText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                const jsonString = rawText.substring(firstBrace, lastBrace + 1);
                parsedDate = JSON.parse(jsonString);
            } else {
                throw new Error("No JSON braces found");
            }
        } catch (parseError) {
            console.error("JSON Parse Failed. Fallback to raw text if safe, or generic error.", parseError);
            console.log("Raw Output was:", rawText);
            // Fallback: If model refused JSON but gave text, try to use it as response, but skip memory.
            // Or just return a standard error if completely malformed.
            return rawText; // Attempt to return the raw text as the response (risky but better than crash)
        }

        // 5. Apply Memory Updates (if valid) - AWAIT THIS NOW
        if (parsedDate && parsedDate.memory_updates && userId) {
            try {
                await memoryOps.applyMemoryUpdates(db, userId, parsedDate.memory_updates, userText);
            } catch (memErr) {
                console.error("Memory update failed, but continuing:", memErr);
            }
        }

        const assistantResponse = parsedDate.assistant_response || "I'm having trouble processing that right now.";

        // 6. Generate Patient Card (Call #2)
        let patientCard = "";
        if (userId) {
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


app.get("/aiSearch", async (req, res) => {
    try {
        const userText = req.query.query;
        const response = await geminiResponse(userText);
        res.send(response);
    } catch (error) {
        console.error("aiSearch Error:", error.message);
        res.status(500).send("AI Search is temporarily unavailable. Please try again later.");
    }
});

app.get("/aiAsist", async (req, res) => {
    try {
        const userText = req.query.query;
        const response = await getDietitianResponse(userText);
        res.send(response);
    } catch (error) {
        console.error("aiAsist Error:", error.message);
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

// Database setup
const db = new sqlite3.Database("users.db");

db.serialize(() => {
    // 1. Foreign Key Desteği
    db.run("PRAGMA foreign_keys = ON;");

    // 2. Mevcut Users Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        username TEXT NOT NULL
    )`);

    // 3. Master Listeler (Ana Listeler)
    // Foods
    db.run(`CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    )`);

    // Sensory Attributes
    db.run(`CREATE TABLE IF NOT EXISTS sensory_attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    )`);

    // Conditions
    db.run(`CREATE TABLE IF NOT EXISTS conditions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    )`);

    // 4. Kullanıcı Eşleştirme Tabloları (Mappings)
    // User - Food Preferences
    db.run(`CREATE TABLE IF NOT EXISTS user_food_preferences (
        user_id INTEGER NOT NULL,
        food_id INTEGER NOT NULL,
        is_safe INTEGER NOT NULL CHECK (is_safe IN (0, 1)),
        PRIMARY KEY (user_id, food_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
    )`);

    // User - Sensory Triggers
    db.run(`CREATE TABLE IF NOT EXISTS user_sensory_triggers (
        user_id INTEGER NOT NULL,
        attribute_id INTEGER NOT NULL,
        is_problematic INTEGER NOT NULL CHECK (is_problematic IN (0, 1)),
        PRIMARY KEY (user_id, attribute_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (attribute_id) REFERENCES sensory_attributes(id) ON DELETE CASCADE
    )`);

    // User - Conditions
    db.run(`CREATE TABLE IF NOT EXISTS user_conditions (
        user_id INTEGER NOT NULL,
        condition_id INTEGER NOT NULL,
        has_condition INTEGER NOT NULL CHECK (has_condition IN (0, 1)),
        PRIMARY KEY (user_id, condition_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (condition_id) REFERENCES conditions(id) ON DELETE CASCADE
    )`);

    // 5. Seed Verileri (Başlangıç Verileri)
    // Foods
    const foods = [
        'Apple', 'Banana', 'Orange', 'Strawberry', 'Grapes',
        'Chicken', 'Beef', 'Pork', 'Turkey', 'Lamb',
        'Rice', 'Pasta', 'Bread', 'Toast', 'Cereal',
        'Potato', 'French Fries', 'Mashed Potatoes', 'Sweet Potato',
        'Carrot', 'Broccoli', 'Cucumber', 'Tomato', 'Lettuce',
        'Milk', 'Cheese', 'Yogurt', 'Ice Cream', 'Butter',
        'Egg', 'Scrambled Eggs', 'Boiled Eggs',
        'Pizza', 'Burger', 'Sandwich', 'Soup',
        'Chocolate', 'Chips', 'Crackers', 'Popcorn', 'Cookie',
        'Water', 'Juice', 'Soda', 'Tea', 'Coffee',
        'Peanut Butter', 'Jam', 'Honey', 'Nuts', 'Fish'
    ];
    // Optimize: Use a single transaction or prepared statement if list is long, 
    // but for 50 items, individual INSERT OR IGNORE is acceptable for startup.
    // Actually, let's use a single parameterized query with placeholders for cleaner code if possible,
    // but standard SQL doesn't support bulk insert nicely across all versions without multiple VALUES.
    // We will stick to the loop for simplicity and readability as requested "minimal".
    const insertFood = db.prepare("INSERT OR IGNORE INTO foods (name) VALUES (?)");
    foods.forEach(food => insertFood.run(food));
    insertFood.finalize();

    // Sensory Attributes
    const sensoryAttributes = [
        'Crunchy Texture', 'Slimy Texture', 'Mushy Texture', 'Chewy Texture',
        'Strong Smell', 'Lack of Smell',
        'Bright Colors', 'Mixed Textures', 'Lumpy',
        'Hot Temperature', 'Cold Temperature',
        'Spicy Taste', 'Bitter Taste', 'Sour Taste', 'Bland Taste'
    ];
    const insertSensory = db.prepare("INSERT OR IGNORE INTO sensory_attributes (name) VALUES (?)");
    sensoryAttributes.forEach(attr => insertSensory.run(attr));
    insertSensory.finalize();

    // Conditions
    const conditions = [
        'Anxiety', 'Depression', 'OCD',
        'Autism / ASD', 'ADHD',
        'Sensory Processing Disorder',
        'Emetophobia', 'Choking Phobia',
        'Lactose Intolerance', 'Gluten Sensitivity',
        'Acid Reflux',
        'Iron Deficiency', 'Vitamin D Deficiency',
        'Social Anxiety', 'General Fatigue'
    ];
    const insertCondition = db.prepare("INSERT OR IGNORE INTO conditions (name) VALUES (?)");
    conditions.forEach(cond => insertCondition.run(cond));
    insertCondition.finalize();

    console.log("Database initialized with V1 schema and seed data.");
});


// API: User signup
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

// API: User signin
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

// API: Chat message
app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;
        // Trusted Identity from Header (set by Frontend Proxy)
        const userId = req.get('X-User-Id');

        console.log(`Chat message from User[${userId || 'Guest'}]:`, message);

        const { assistant_response, patient_card } = await getDietitianResponse(message, userId);
        res.json({
            response: assistant_response,
            patient_card: patient_card
        });
    } catch (error) {
        console.error("Chat route crash prevented:", error);
        res.status(500).json({ response: "Üzgünüm, şu an bir hata oluştu. Daha sonra tekrar deneyebilir misiniz?" });
    }
});

// Root endpoint
app.get("/", (req, res) => {
    res.send("ARFID Backend API çalışıyor 🚀");
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
