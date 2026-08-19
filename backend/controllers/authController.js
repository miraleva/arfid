/**
 * Auth Controller
 * Handles HTTP requests and responses for user registration and authentication.
 */

const userRepository = require("../repositories/userRepository");

/**
 * Handles user registration (signup).
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function signup(req, res) {
    const { email, password, username } = req.body;
    console.log("signup isteği geldi");

    if (!email || !password || !username) {
        console.log("bilgi eksik");
        return res.status(400).json({ error: "Email, password and username are required" });
    }

    try {
        const newUser = await userRepository.createUser(email, password, username);
        console.log("kaydedildi");
        res.json(newUser);
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * Handles user authentication (signin).
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function signin(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const user = await userRepository.findUserByCredentials(email, password);
        if (user) {
            res.json(user);
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    signup,
    signin
};
