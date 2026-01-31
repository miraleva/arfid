const express = require("express");
const path = require("path");

const session = require("express-session");
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = 4000;

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
    res.render("mainPage", { title: "Ana Sayfa", user: req.session.user });
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



// Signin POST - Backend API'ye bağlı
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await fetch("http://localhost:3000/signin", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': process.env.INTERNAL_SHARED_SECRET
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            req.session.user = { id: data.id, email: data.email, username: data.username };
            res.redirect("/chat");
        } else {
            res.render("signin", { error: data.error || "Email veya şifre yanlış" });
        }
    } catch (error) {
        res.render("signin", { error: "Bağlantı hatası" });
    }
});

// Signup POST - Backend API'ye bağlı
app.post("/signup", async (req, res) => {
    const { email, password, username } = req.body;

    try {
        const response = await fetch("http://localhost:3000/signup", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': process.env.INTERNAL_SHARED_SECRET
            },
            body: JSON.stringify({ email, password, username })
        });

        const data = await response.json();

        if (response.ok) {
            req.session.user = { id: data.id, email: data.email, username: data.username };
            res.redirect("/chat");
        } else {
            res.render("signup", { error: data.error || "Kayıt sırasında bir hata oluştu" });
        }
    } catch (error) {
        res.render("signup", { error: "Bağlantı hatası" });
    }
});

// Chat POST - Proxy to Backend
app.post("/chat", isAuthenticated, async (req, res) => {
    const { message } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    try {
        const response = await fetch("http://localhost:3000/chat", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId, // Pass trusted Identity
                'X-Internal-Token': process.env.INTERNAL_SHARED_SECRET
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Chat proxy hatası:", error);
        res.status(500).json({ error: "Backend bağlantı hatası" });
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
