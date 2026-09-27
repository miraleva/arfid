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

const DIETARY_ALLOWED_CHARS_REGEX = /^[a-zA-Z0-9çÇğĞıİöÖşŞüÜ\s\-]+$/;
const DIETARY_HAS_LETTER_REGEX = /[a-zA-ZçÇğĞıİöÖşŞüÜ]/;

function validateDietaryName(rawName) {
    if (!rawName || typeof rawName !== 'string') {
        return { valid: false, error: "Lütfen bir isim girin." };
    }
    const trimmed = rawName.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
        return { valid: false, error: "Girdi 2 ile 40 karakter arasında olmalıdır." };
    }
    if (!DIETARY_ALLOWED_CHARS_REGEX.test(trimmed)) {
        return { valid: false, error: "Yalnızca harf, rakam, boşluk ve tire (-) kullanabilirsiniz. Nokta veya özel karakter içeremez." };
    }
    if (!DIETARY_HAS_LETTER_REGEX.test(trimmed)) {
        return { valid: false, error: "Girdi sadece rakamlardan oluşamaz, en az 1 harf içermelidir." };
    }
    return { valid: true, cleanName: trimmed };
}

/**
 * Adds or updates a food preference for the authenticated user.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function addFoodPreference(req, res) {
    try {
        const userId = req.get("X-User-Id");
        const { name, isSafe } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: "Kullanıcı doğrulanamadı" });
        }

        const validation = validateDietaryName(name);
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        const safeVal = (isSafe === 1 || isSafe === true || isSafe === "1") ? 1 : 0;
        const result = await memoryRepository.addUserFoodPreference(userId, validation.cleanName, safeVal);

        res.json({
            success: true,
            alreadyExists: result.alreadyExists || false,
            updated: result.updated || false,
            unverified: result.unverified || false,
            previousState: result.previousState || null,
            food: result.food
        });
    } catch (err) {
        if (err.message && err.message.includes("tanınan bir gıda olarak bulunamadı")) {
            return res.status(400).json({ success: false, error: err.message });
        }
        console.error("addFoodPreference error:", err);
        res.status(500).json({ success: false, error: err.message || "Gıda tercihi eklenemedi" });
    }
}

/**
 * Adds a sensory trigger for the authenticated user.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
async function addSensoryTrigger(req, res) {
    try {
        const userId = req.get("X-User-Id");
        const { name } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: "Kullanıcı doğrulanamadı" });
        }

        const validation = validateDietaryName(name);
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        const result = await memoryRepository.addUserSensoryTrigger(userId, validation.cleanName, 1);

        res.json({
            success: true,
            alreadyExists: result.alreadyExists || false,
            trigger: result.trigger
        });
    } catch (err) {
        console.error("addSensoryTrigger error:", err);
        res.status(500).json({ success: false, error: err.message || "Duyusal tetikleyici eklenemedi" });
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
    addFoodPreference,
    addSensoryTrigger,
    deleteFoodPreference,
    deleteSensoryTrigger,
    updateProfile,
    changePassword,
    deleteAccount
};
