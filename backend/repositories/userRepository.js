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

/**
 * Updates a user's profile (username and/or email).
 * Verifies email uniqueness across other users.
 * 
 * @param {number|string} userId - User ID
 * @param {{ username?: string, email?: string }} data - Updated profile data
 * @returns {Promise<import('../types').User>} Updated user object
 */
function updateProfile(userId, { username, email }) {
    return new Promise((resolve, reject) => {
        const cleanEmail = email ? email.trim().toLowerCase() : null;
        const cleanUsername = username ? username.trim() : null;

        if (cleanEmail) {
            db.get(
                "SELECT id FROM users WHERE email = ? AND id != ?",
                [cleanEmail, userId],
                (err, existing) => {
                    if (err) return reject(err);
                    if (existing) {
                        const duplicateError = new Error("EMAIL_ALREADY_EXISTS");
                        duplicateError.code = "EMAIL_ALREADY_EXISTS";
                        return reject(duplicateError);
                    }
                    performUpdate();
                }
            );
        } else {
            performUpdate();
        }

        function performUpdate() {
            db.run(
                "UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?",
                [cleanUsername, cleanEmail, userId],
                function (err) {
                    if (err) {
                        if (err.message && err.message.includes("UNIQUE constraint failed")) {
                            const duplicateError = new Error("EMAIL_ALREADY_EXISTS");
                            duplicateError.code = "EMAIL_ALREADY_EXISTS";
                            return reject(duplicateError);
                        }
                        return reject(err);
                    }
                    findUserById(userId)
                        .then(updated => resolve(updated))
                        .catch(reject);
                }
            );
        }
    });
}

/**
 * Updates user password after validating current password.
 * 
 * @param {number|string} userId - User ID
 * @param {string} currentPassword - Current plain password
 * @param {string} newPassword - New plain password
 * @returns {Promise<{ success: boolean }>}
 */
function updatePassword(userId, currentPassword, newPassword) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, password FROM users WHERE id = ?",
            [userId],
            (err, user) => {
                if (err) return reject(err);
                if (!user) {
                    const notFoundError = new Error("USER_NOT_FOUND");
                    notFoundError.code = "USER_NOT_FOUND";
                    return reject(notFoundError);
                }
                if (user.password !== currentPassword) {
                    const invalidPassError = new Error("INVALID_CURRENT_PASSWORD");
                    invalidPassError.code = "INVALID_CURRENT_PASSWORD";
                    return reject(invalidPassError);
                }

                if (newPassword === currentPassword) {
                    const samePassError = new Error("SAME_AS_CURRENT_PASSWORD");
                    samePassError.code = "SAME_AS_CURRENT_PASSWORD";
                    return reject(samePassError);
                }

                db.run(
                    "UPDATE users SET password = ? WHERE id = ?",
                    [newPassword, userId],
                    function (updateErr) {
                        if (updateErr) return reject(updateErr);
                        resolve({ success: true });
                    }
                );
            }
        );
    });
}

/**
 * Permanently deletes a user and cascades related records.
 * 
 * @param {number|string} userId - User ID
 * @returns {Promise<{ success: boolean }>}
 */
function deleteUser(userId) {
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM users WHERE id = ?",
            [userId],
            function (err) {
                if (err) return reject(err);
                resolve({ success: this.changes > 0 });
            }
        );
    });
}

module.exports = {
    createUser,
    findUserByCredentials,
    findUserById,
    updateProfile,
    updatePassword,
    deleteUser
};
