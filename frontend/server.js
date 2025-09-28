const express = require("express");
const path = require("path");
const session = require("express-session");

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
    if(req.session.user) { // 🟢 Kullanıcı giriş yaptıysa devam et
        return next();
    }
    res.redirect("/signin"); // 🟢 Giriş yoksa signin sayfasına yönlendir
}

// Ana sayfa
app.get("/", isAuthenticated, (req, res) => { // 🟢 isAuthenticated ekledik
    res.render("index", { title: "Ana Sayfa", user: req.session.user });
});
// Signin sayfası
app.get("/signin", (req, res) => {
    res.render("signin");
});

// Signup sayfası
app.get("/signup", (req, res) => {
    res.render("signup");
});

app.get("/forgot", (req, res) => {
    res.render("forgot");
});



// Signin POST - Backend API'ye bağlı
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await fetch("http://localhost:3000/signin", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            req.session.user = { email: data.email, username: data.username };
            res.redirect("/");
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
            },
            body: JSON.stringify({ email, password, username })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            req.session.user = { email: data.email, username: data.username };
            res.redirect("/");
        } else {
            res.render("signup", { error: data.error || "Kayıt sırasında bir hata oluştu" });
        }
    } catch (error) {
        res.render("signup", { error: "Bağlantı hatası" });
    }
});

// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy(); // 🟢 Session’ı temizle
    res.redirect("/signin"); // 🟢 Giriş sayfasına yönlendir
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
