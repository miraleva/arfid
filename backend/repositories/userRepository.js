/**
 * User Repository
 * Handles all direct SQLite database queries for the 'users' table.
 */

const db = require("../db");

/**
 * Creates a new user in the database.
 * 
 * @param {string} email - User email address
 * @param {string} password - User password (plain/hashed)
 * @param {string} username - User display name
 * @returns {Promise<import('../types').User>} Created user object
 */
function createUser(email, password, username) {
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT INTO users (email, password, username) VALUES (?, ?, ?)",
            [email, password, username],
            function (err) {
                if (err) return reject(err);
                resolve({ id: this.lastID, email, username });
            }
        );
    });
}

/**
 * Finds a user by email and password credentials.
 * 
 * @param {string} email - User email address
 * @param {string} password - User password
 * @returns {Promise<import('../types').User|null>} User object if found, null otherwise
 */
function findUserByCredentials(email, password) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, email, username FROM users WHERE email = ? AND password = ?",
            [email, password],
            (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            }
        );
    });
}

/**
 * Finds a user by their unique ID.
 * 
 * @param {number} id - User unique ID
 * @returns {Promise<import('../types').User|null>} User object if found, null otherwise
 */
function findUserById(id) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, email, username FROM users WHERE id = ?",
            [id],
            (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            }
        );
    });
}

module.exports = {
    createUser,
    findUserByCredentials,
    findUserById
};
