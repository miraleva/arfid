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

module.exports = {
    getDietaryProfile,
    deleteFoodPreference,
    deleteSensoryTrigger
};
