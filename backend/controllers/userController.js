/**
 * User Controller
 * Handles dietary profile querying and deletion of learned food preferences and sensory triggers.
 */

const memoryRepository = require("../repositories/memoryRepository");

/**
 * Retrieves the authenticated user's dietary profile:
 * safe foods, unsafe foods, and sensory triggers.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function getDietaryProfile(req, res) {
    try {
        const userId = req.get("X-User-Id");
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı doğrulanamadı" });
        }

        const [foodPrefs, sensoryTriggers] = await Promise.all([
            memoryRepository.getUserFoodPreferences(userId),
            memoryRepository.getUserSensoryTriggers(userId)
        ]);

        const safeFoods = [];
        const unsafeFoods = [];

        foodPrefs.forEach(item => {
            if (item.is_safe === 1 || item.is_safe === true) {
                safeFoods.push({ id: item.food_id, name: item.name });
            } else {
                unsafeFoods.push({ id: item.food_id, name: item.name });
            }
        });

        const formattedTriggers = sensoryTriggers.map(item => ({
            id: item.attribute_id,
            name: item.name
        }));

        res.json({
            safeFoods,
            unsafeFoods,
            sensoryTriggers: formattedTriggers
        });
    } catch (err) {
        console.error("getDietaryProfile error:", err);
        res.status(500).json({ error: "Beslenme profili alınamadı", safeFoods: [], unsafeFoods: [], sensoryTriggers: [] });
    }
}

/**
 * Deletes a food preference for the authenticated user.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function deleteFoodPreference(req, res) {
    try {
        const userId = req.get("X-User-Id");
        const foodId = Number(req.params.foodId);

        if (!userId || !foodId) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await memoryRepository.deleteUserFoodPreference(userId, foodId);
        res.json({ success });
    } catch (err) {
        console.error("deleteFoodPreference error:", err);
        res.status(500).json({ success: false, error: "Gıda tercihi silinemedi" });
    }
}

/**
 * Deletes a sensory trigger for the authenticated user.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function deleteSensoryTrigger(req, res) {
    try {
        const userId = req.get("X-User-Id");
        const attributeId = Number(req.params.attributeId);

        if (!userId || !attributeId) {
            return res.status(400).json({ success: false, error: "Geçersiz parametreler" });
        }

        const success = await memoryRepository.deleteUserSensoryTrigger(userId, attributeId);
        res.json({ success });
    } catch (err) {
        console.error("deleteSensoryTrigger error:", err);
        res.status(500).json({ success: false, error: "Duyusal tetikleyici silinemedi" });
    }
}

/**
 * Updates profile information (username and/or email).
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function updateProfile(req, res) {
    try {
        const userId = req.get("X-User-Id");
        const { username, email } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: "Kullanıcı doğrulanamadı" });
        }

        if (!username && !email) {
            return res.status(400).json({ success: false, error: "Güncellenecek bilgi girilmedi" });
        }

        const userRepository = require("../repositories/userRepository");
        const updatedUser = await userRepository.updateProfile(userId, { username, email });

        res.json({
            success: true,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                username: updatedUser.username
            }
        });
    } catch (err) {
        if (err.code === "EMAIL_ALREADY_EXISTS") {
            return res.status(409).json({ success: false, error: "Bu e-posta adresi zaten kullanılıyor" });
        }
        console.error("updateProfile error:", err);
        res.status(500).json({ success: false, error: "Profil güncellenemedi" });
    }
}

/**
 * Changes user password after checking current password.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function changePassword(req, res) {
    try {
        const userId = req.get("X-User-Id");
        const { currentPassword, newPassword } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: "Kullanıcı doğrulanamadı" });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: "Mevcut şifre ve yeni şifre gereklidir" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: "Yeni şifre en az 6 karakter olmalıdır" });
        }

        const userRepository = require("../repositories/userRepository");
        await userRepository.updatePassword(userId, currentPassword, newPassword);

        res.json({ success: true, message: "Şifre başarıyla güncellendi" });
    } catch (err) {
        if (err.code === "INVALID_CURRENT_PASSWORD") {
            return res.status(400).json({ success: false, error: "Mevcut şifreniz hatalı" });
        }
        if (err.code === "SAME_AS_CURRENT_PASSWORD") {
            return res.status(400).json({ success: false, error: "Yeni şifre mevcut şifrenizle aynı olamaz." });
        }
        console.error("changePassword error:", err);
        res.status(500).json({ success: false, error: "Şifre değiştirilemedi" });
    }
}

/**
 * Deletes user account and cascades all associated data.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function deleteAccount(req, res) {
    try {
        const userId = req.get("X-User-Id");

        if (!userId) {
            return res.status(401).json({ success: false, error: "Kullanıcı doğrulanamadı" });
        }

        const userRepository = require("../repositories/userRepository");
        const success = await userRepository.deleteUser(userId);

        res.json({ success, message: "Hesap başarıyla silindi" });
    } catch (err) {
        console.error("deleteAccount error:", err);
        res.status(500).json({ success: false, error: "Hesap silinemedi" });
    }
}

module.exports = {
    getDietaryProfile,
    deleteFoodPreference,
    deleteSensoryTrigger,
    updateProfile,
    changePassword,
    deleteAccount
};
