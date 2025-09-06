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


// Örnek signin POST
app.post("/signin", (req, res) => {
    const { email, password } = req.body;

 // Basit kontrol (demo amaçlı)
    if(email === "test@test.com" && password === "1234") {
        const response = fetch("http://localhost/3000/count");
        req.session.user = { email }; // 🟢 Kullanıcıyı session’a ekledik
        res.redirect("/"); // 🟢 Başarılı girişte ana sayfaya yönlendir
    } else {
        res.render("signin", { title: "Giriş Yap", error: "Email veya şifre yanlış" });
    }
});

// Signup POST
app.post("/signup", (req, res) => {
    const { email, password } = req.body;
    // Kayıt işlemleri burada yapılabilir
    // 🟢 Demo için kullanıcıyı direkt session’a ekleyelim
    req.session.user = { email };
    res.redirect("/"); // 🟢 Kayıt sonrası ana sayfaya yönlendir
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
