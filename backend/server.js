// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = 3000;

// JSON gövdesini okumak için middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Örnek kullanıcı listesi
let users = [
  { id: 1, name: "Slim Easy", age:8 },
  { id: 2, name: "Whimsy Lou", age: 10 }
];

// Root endpoint
app.get("/", (req, res) => {
  res.send("Merhaba! Express API çalışıyor 🚀");
});

// Tüm kullanıcıları getir
app.get("/users", (req, res) => {
  res.json(users);
});

// ID'ye göre kullanıcı getir
app.get("/users/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const user = users.find(u => u.id === id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: "Kullanıcı bulunamadı" });
  }
});

// Yeni kullanıcı ekle
app.post("/users", (req, res) => {
  const newUser = {
    id: users.length + 1,
    name: req.body.name,
    age: req.body.age
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
