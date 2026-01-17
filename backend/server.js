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
const PORT = 3000;



async function geminiResponse(userText) {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userText,
    });
    console.log(response.text);
    return response.text;
}
async function getDietitianResponse(userText) {
    const prompt = "Sen bir diyetisyensin. Verilen mesajı maksimum 200 karakter uzunluğunda cevapla. Verilen mesajın dışında bir cevap verme. İşte kullanıcı mesajı: ";
    const response = await geminiResponse(prompt.concat(userText));
    return response;
}


app.get("/aiSearch", async (req, res) => {
    const userText = req.query.query;
    const response = await geminiResponse(userText);
    res.send(response);

});

app.get("/aiAsist", async (req, res) => {
    const userText = req.query.query;
    const response = await getDietitianResponse(userText);
    res.send(response);

});

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Database setup
const db = new sqlite3.Database("users.db");

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        username TEXT NOT NULL
    )`);
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
    const { message } = req.body;
    console.log("Chat mesajı geldi:", message);
    const response = await getDietitianResponse(message);
    res.json({ response: response });
});

// Root endpoint
app.get("/", (req, res) => {
    res.send("ARFID Backend API çalışıyor 🚀");
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
