/**
 * Tool: checkFoodSafety
 * Checks whether specified food items match user's safe/unsafe food preferences.
 * Supports fuzzy matching for typos and aliases.
 */

const { getUserFoodPreferences } = require("../repositories/memoryRepository");
const { normalizeString, createFuzzyMatcher } = require("./utils/fuzzyMatch");

const toolDeclaration = {
    name: "checkFoodSafety",
    description: "Kullanıcının bahsettiği veya önerilecek yiyeceklerin/malzemelerin kullanıcının ARFID güvenli (safe) ve tetikleyici/kaçınılan (unsafe) gıda listesinde olup olmadığını kontrol eder. Bir tarif veya malzeme önerirken ya da kullanıcı bir yiyeceğin güvenliğini sorduğunda kullanılır.",
    parameters: {
        type: "object",
        properties: {
            foodNames: {
                type: "array",
                description: "Kontrol edilecek yiyecek veya malzeme isimleri (örn: ['tavuk', 'mantar', 'domates'])",
                items: {
                    type: "string"
                }
            }
        },
        required: ["foodNames"]
    }
};

/**
 * Checks food items against user's safe/unsafe food records.
 * 
 * @param {Object} args - Tool arguments
 * @param {Array<string>} args.foodNames - List of food names to check
 * @param {Object} [context={}] - Invocation context
 * @param {number} [context.userId] - Current user ID (if authenticated)
 * @returns {Promise<Object>} Food safety evaluation result
 */
async function checkFoodSafety(args, context = {}) {
    const rawList = args && Array.isArray(args.foodNames) ? args.foodNames : [];
    const userId = context.userId;

    if (rawList.length === 0) {
        return {
            status: "error",
            message: "Kontrol edilecek en az bir yiyecek ismi belirtilmelidir.",
            checked_items: []
        };
    }

    // Guest Mode / No User ID Check:
    // Hata fırlatılmaz; tüm malzemeler güvenli şekilde 'unknown' ve net açıklamayla döndürülür.
    if (!userId) {
        return {
            status: "success",
            user_authenticated: false,
            message: "Kullanıcı oturumu bulunmadığı (misafir modu) için kişisel güvenli/kaçınılan gıda listesi kontrol edilemedi.",
            checked_items: rawList.map(name => ({
                requested_name: name,
                matched_name: null,
                status: "unknown",
                reason: "GUEST_MODE_NO_USER",
                message: "Kullanıcı oturumu yok, kişisel gıda profili sorgulanamadı."
            }))
        };
    }

    // Kullanıcının kayıtlı tercihlerini veritabanından al
    const userPrefs = await getUserFoodPreferences(userId);

    // Kullanıcının hiç tercihi yoksa
    if (!userPrefs || userPrefs.length === 0) {
        return {
            status: "success",
            user_authenticated: true,
            message: "Kullanıcının kayıtlı hiçbir güvenli veya kaçınılan yiyecek tercihi bulunmuyor.",
            checked_items: rawList.map(name => ({
                requested_name: name,
                matched_name: null,
                status: "unknown",
                reason: "NOT_IN_PREFERENCES",
                message: "Kullanıcının profilinde bu veya başka herhangi bir gıda kaydı bulunmuyor."
            }))
        };
    }

    // Arama için normalize edilmiş liste ve Fuse.js index'i oluştur
    const normalizedPrefs = userPrefs.map(pref => ({
        ...pref,
        normalizedName: normalizeString(pref.name)
    }));

    const fuseInstance = createFuzzyMatcher(
        normalizedPrefs,
        [{ name: "normalizedName", weight: 1.0 }],
        { threshold: 0.35 }
    );

    const checkedItems = [];

    for (const rawName of rawList) {
        if (!rawName || typeof rawName !== "string") continue;

        const normalized = normalizeString(rawName);
        if (!normalized || normalized.length < 2) {
            checkedItems.push({
                requested_name: rawName,
                matched_name: null,
                status: "unknown",
                reason: "UNRESOLVED_INPUT",
                message: "Geçersiz veya anlaşılamayan yiyecek ismi."
            });
            continue;
        }

        // 1. Doğrudan tam eşleşme
        let matchedPref = normalizedPrefs.find(p => p.normalizedName === normalized);

        // 2. Alt metin / kelime eşleşmesi (örn. "tavuk göğsü" içinde kullanıcının "tavuk" kaydı)
        if (!matchedPref) {
            matchedPref = normalizedPrefs.find(p => {
                return (p.normalizedName.length >= 3 && normalized.includes(p.normalizedName)) ||
                       (normalized.length >= 3 && p.normalizedName.includes(normalized));
            });
        }

        // 3. Fuse.js ile Fuzzy Matching (yazım hataları örn. "mntar" -> "mantar", "tvuk" -> "tavuk")
        if (!matchedPref) {
            const results = fuseInstance.search(normalized);
            if (results && results.length > 0 && results[0].score <= 0.38) {
                matchedPref = results[0].item;
            } else {
                // Çok kelimeli girdiler için kelime bazlı fuzzy denemesi
                const words = normalized.split(/\s+/).filter(w => w.length >= 3);
                for (const word of words) {
                    const wordResults = fuseInstance.search(word);
                    if (wordResults && wordResults.length > 0 && wordResults[0].score <= 0.25) {
                        matchedPref = wordResults[0].item;
                        break;
                    }
                }
            }
        }

        if (matchedPref) {
            const isSafe = matchedPref.is_safe === 1;
            checkedItems.push({
                requested_name: rawName,
                matched_name: matchedPref.name,
                status: isSafe ? "safe" : "unsafe",
                is_safe: matchedPref.is_safe,
                notes: null,
                message: isSafe 
                    ? `'${matchedPref.name}' kullanıcının güvenli gıdalar listesinde yer alıyor.`
                    : `'${matchedPref.name}' kullanıcının kaçındığı/tetikleyici (unsafe) gıdalar listesinde yer alıyor.`
            });
        } else {
            checkedItems.push({
                requested_name: rawName,
                matched_name: null,
                status: "unknown",
                reason: "NOT_IN_PREFERENCES",
                message: "Kullanıcının güvenli veya kaçınılan gıda listesinde bu yiyeceğe ait bir kayıt bulunmuyor."
            });
        }
    }

    return {
        status: "success",
        user_authenticated: true,
        checked_items_count: checkedItems.length,
        checked_items: checkedItems
    };
}

module.exports = {
    toolDeclaration,
    execute: checkFoodSafety
};
