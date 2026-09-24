const express = require("express");
const path = require("path");

const session = require("express-session");
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = 4000;
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:3000";

// EJS kullanımı
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Statik dosyalar
app.use(express.static(path.join(__dirname, "public")));

// JSON gövdesi okumak için
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // form dataları için

// 🟢 Session middleware
app.use(session({
    secret: "gizli_key", // 🟢 Oturum için gizli key
    resave: false,
    saveUninitialized: false,
}));

// 🟢 i18n Configuration
const i18n = require("i18n");
i18n.configure({
    locales: ["tr", "en"],
    directory: path.join(__dirname, "locales"),
    defaultLocale: "tr",
    autoReload: true,
    updateFiles: false,
    syncFiles: false,
    cookie: "arfid_lang",
    queryParameter: "lang",
    objectNotation: true
});

app.use(i18n.init);

// 🟢 Custom locale middleware (session-first with returnTo support)
app.use((req, res, next) => {
    // 1. Session locale preference
    if (req.session && req.session.locale) {
        req.setLocale(req.session.locale);
    } else {
        req.setLocale("tr");
    }

    // Expose helpers globally to all EJS templates
    res.locals.t = function(key) {
        return res.__(key);
    };
    res.locals.currentLocale = req.getLocale();
    res.locals.currentPath = req.path;
    res.locals.user = req.session ? req.session.user : null;
    next();
});

// 🟢 Route: Change Locale
app.get("/set-locale/:lang", (req, res) => {
    const lang = req.params.lang;
    const supportedLocales = ["tr", "en"];
    const targetLocale = supportedLocales.includes(lang) ? lang : "tr";

    if (req.session) {
        req.session.locale = targetLocale;
    }

    // Safe returnTo redirection
    let returnTo = req.query.returnTo;
    if (!returnTo || typeof returnTo !== "string" || !returnTo.startsWith("/")) {
        returnTo = "/";
    }

    res.redirect(returnTo);
});

// 🟢 Auth kontrol middleware
function isAuthenticated(req, res, next) {
    if (req.session.user) { // 🟢 Kullanıcı giriş yaptıysa devam et
        return next();
    }
    console.log("ok");
    res.redirect("/signin"); // 🟢 Giriş yoksa signin sayfasına yönlendir
}

// Ana sayfa
app.get("/", (req, res) => {
    if (req.session.user) {
        return res.redirect("/chat");
    }
    res.render("mainPage", { title: res.__("meta.main_title") });
});
// Signin sayfası
app.get("/signin", (req, res) => {
    if (req.session.user) {
        return res.redirect("/chat");
    }
    res.render("signin");
});

// Signup sayfası
app.get("/signup", (req, res) => {
    if (req.session.user) {
        return res.redirect("/chat");
    }
    res.render("signup");
});

app.get("/forgot", (req, res) => {
    if (req.session.user) {
        return res.redirect("/chat");
    }
    res.render("forgot");
});

// Chat sayfası
app.get("/chat", isAuthenticated, (req, res) => {
    res.render("chat", { title: "Chat", user: req.session.user });
});



const apiClient = require("./apiClient");

// Signin POST - Backend API'ye bağlı
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await apiClient.signin(email, password);

        if (result.ok) {
            req.session.user = { id: result.data.id, email: result.data.email, username: result.data.username };
            res.redirect("/chat");
        } else {
            res.render("signin", { error: result.data.error || "Email veya şifre yanlış" });
        }
    } catch (error) {
        res.render("signin", { error: "Bağlantı hatası" });
    }
});

// Signup POST - Backend API'ye bağlı
app.post("/signup", async (req, res) => {
    const { email, password, username } = req.body;

    try {
        const result = await apiClient.signup(email, password, username);

        if (result.ok) {
            req.session.user = { id: result.data.id, email: result.data.email, username: result.data.username };
            res.redirect("/chat");
        } else {
            res.render("signup", { error: result.data.error || "Kayıt sırasında bir hata oluştu" });
        }
    } catch (error) {
        res.render("signup", { error: "Bağlantı hatası" });
    }
});

// Chat POST - Proxy to Backend
app.post("/chat", isAuthenticated, async (req, res) => {
    const { message, conversationId } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    try {
        const result = await apiClient.sendChatMessage(message, userId, conversationId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Chat proxy hatası:", error);
        res.status(500).json({ error: "Backend bağlantı hatası" });
    }
});

// Conversations List GET - Proxy to Backend
app.get("/chat/conversations", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    try {
        const result = await apiClient.getConversations(userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Get conversations proxy hatası:", error);
        res.status(500).json({ conversations: [] });
    }
});

// Conversation Messages GET - Proxy to Backend
app.get("/chat/conversations/:id/messages", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const conversationId = req.params.id;

    try {
        const result = await apiClient.getConversationMessages(conversationId, userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Get conversation messages proxy hatası:", error);
        res.status(500).json({ messages: [] });
    }
});

// Conversation Rename PATCH - Proxy to Backend
app.patch("/chat/conversations/:id/rename", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const conversationId = req.params.id;
    const { title } = req.body;

    try {
        const result = await apiClient.renameConversation(conversationId, title, userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Rename conversation proxy hatası:", error);
        res.status(500).json({ success: false, error: "Güncelleme hatası" });
    }
});

// Conversation Pin PATCH - Proxy to Backend
app.patch("/chat/conversations/:id/pin", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const conversationId = req.params.id;

    try {
        const result = await apiClient.togglePinConversation(conversationId, userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Toggle pin proxy hatası:", error);
        res.status(500).json({ success: false, error: "Sabitleme hatası" });
    }
});

// Conversation DELETE - Proxy to Backend
app.delete("/chat/conversations/:id", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const conversationId = req.params.id;

    try {
        const result = await apiClient.deleteConversation(conversationId, userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Delete conversation proxy hatası:", error);
        res.status(500).json({ success: false, error: "Silme hatası" });
    }
});

// Saved Widgets (Tariflerim) GET - Proxy to Backend
app.get("/widgets/saved", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    try {
        const result = await apiClient.getSavedWidgets(userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Get saved widgets proxy hatası:", error);
        res.status(500).json({ widgets: [] });
    }
});

// Saved Widget PIN - Proxy to Backend
app.patch("/widgets/saved/:id/pin", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const widgetId = req.params.id;

    try {
        const result = await apiClient.togglePinWidget(widgetId, userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Pin widget proxy hatası:", error);
        res.status(500).json({ success: false, error: "Sabitleme hatası" });
    }
});

// Saved Widget DELETE - Proxy to Backend
app.delete("/widgets/saved/:id", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const widgetId = req.params.id;

    try {
        const result = await apiClient.deleteWidget(widgetId, userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Delete widget proxy hatası:", error);
        res.status(500).json({ success: false, error: "Silme hatası" });
    }
});

// Chat History GET - Proxy to Backend (Legacy compatibility)
app.get("/chat/history", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    try {
        const result = await apiClient.getChatHistory(userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Chat history proxy hatası:", error);
        res.status(500).json({ messages: [] });
    }
});

// Chat Session DELETE - Proxy to Backend (Legacy compatibility)
app.delete("/chat/session", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const { messageIds } = req.body;

    try {
        const result = await apiClient.deleteChatSession(messageIds, userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Delete session proxy hatası:", error);
        res.status(500).json({ success: false });
    }
});

// Dietary Profile GET - Proxy to Backend
app.get("/user/dietary-profile", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    try {
        const result = await apiClient.getDietaryProfile(userId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Get dietary profile proxy hatası:", error);
        res.status(500).json({ safeFoods: [], unsafeFoods: [], sensoryTriggers: [] });
    }
});

// Delete Food Preference DELETE - Proxy to Backend
app.delete("/user/dietary-profile/food/:foodId", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const foodId = req.params.foodId;

    try {
        const result = await apiClient.deleteFoodPreference(userId, foodId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Delete food preference proxy hatası:", error);
        res.status(500).json({ success: false, error: "Silme hatası" });
    }
});

// Delete Sensory Trigger DELETE - Proxy to Backend
app.delete("/user/dietary-profile/sensory/:attributeId", isAuthenticated, async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;
    const attributeId = req.params.attributeId;

    try {
        const result = await apiClient.deleteSensoryTrigger(userId, attributeId);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error("Delete sensory trigger proxy hatası:", error);
        res.status(500).json({ success: false, error: "Silme hatası" });
    }
});

// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
