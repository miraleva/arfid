/**
 * Tool: calculateSensoryFit
 * Evaluates the sensory fit score and conflicting traits between a recommended food/recipe
 * and the user's recorded sensory triggers (user_sensory_triggers).
 * 
 * Note: Purely INFORMATIVE, non-blocking tool to assist the dietitian in providing empathetic guidance.
 */

const { getUserSensoryTriggers, getMasterLists } = require("../repositories/memoryRepository");
const { normalizeString, createFuzzyMatcher } = require("./utils/fuzzyMatch");

const toolDeclaration = {
    name: "calculateSensoryFit",
    description: "Önerilecek veya kullanıcının sorduğu bir yemeğin/tarifin tahmini duyusal ve dokusal özelliklerini (örneğin: 'mushy', 'crunchy', 'cold', 'strong smell') kullanıcının kayıtlı duyusal tetikleyici profiliyle karşılaştırarak duyusal uyum skoru ve çakışan özellikleri hesaplar. Bir yemek/tarif önerirken veya dokusal uyum değerlendirirken kullanılır.",
    parameters: {
        type: "object",
        properties: {
            foodName: {
                type: "string",
                description: "Değerlendirilen yemek veya tarifin adı (örn: 'Yulaflı Muzlu Smoothie', 'Fırında Çıtır Patates')"
            },
            estimatedSensoryTags: {
                type: "array",
                description: "Yemeğin barındırdığı tahmini duyusal/dokusal nitelikler (örn: ['mushy', 'cold', 'smooth', 'sweet'])",
                items: {
                    type: "string"
                }
            }
        },
        required: ["foodName", "estimatedSensoryTags"]
    }
};

/**
 * Executes sensory fit evaluation.
 * 
 * @param {Object} args - Tool arguments
 * @param {string} args.foodName - Food / recipe title
 * @param {Array<string>} args.estimatedSensoryTags - Estimated sensory traits from model
 * @param {Object} [context={}] - Invocation context
 * @param {number} [context.userId] - Current user ID (if authenticated)
 * @returns {Promise<Object>} Sensory fit evaluation result
 */
async function calculateSensoryFit(args, context = {}) {
    const foodName = (args && typeof args.foodName === "string") ? args.foodName.trim() : "Belirtilmemiş Yemek";
    const rawTags = (args && Array.isArray(args.estimatedSensoryTags)) ? args.estimatedSensoryTags : [];
    const userId = context.userId;

    if (rawTags.length === 0) {
        return {
            status: "error",
            error_code: "EMPTY_TAGS",
            message: "Değerlendirme için en az bir tahmini duyusal özellik (estimatedSensoryTags) belirtilmelidir."
        };
    }

    // Guest Mode / No User ID Check:
    if (!userId) {
        return {
            status: "success",
            user_authenticated: false,
            foodName: foodName,
            fitScore: 100,
            recommendation: "neutral_no_profile",
            conflictingTraits: [],
            matchingTraits: rawTags,
            unrecognizedTags: [],
            message: "Kullanıcı oturumu bulunmadığı (misafir modu) için kişisel duyusal profil değerlendirilemedi. Genel öneri sunulabilir."
        };
    }

    // 1. Fetch user triggers and master sensory attributes
    const [userTriggers, masterLists] = await Promise.all([
        getUserSensoryTriggers(userId),
        getMasterLists()
    ]);

    // Master attributes list
    const masterSensory = (masterLists && masterLists.sensory) ? masterLists.sensory : [];
    const normalizedMaster = masterSensory.map(name => ({
        originalName: name,
        normalizedName: normalizeString(name)
    }));

    // Normalized user problematic triggers
    const normalizedTriggers = (userTriggers || []).map(tr => ({
        originalName: tr.name,
        normalizedName: normalizeString(tr.name)
    }));

    // User has no recorded triggers -> neutral high fit
    if (normalizedTriggers.length === 0) {
        return {
            status: "success",
            user_authenticated: true,
            foodName: foodName,
            fitScore: 100,
            recommendation: "neutral_no_profile",
            conflictingTraits: [],
            matchingTraits: rawTags,
            unrecognizedTags: [],
            message: "Kullanıcının profilinde kayıtlı herhangi bir duyusal tetikleyici bulunmuyor."
        };
    }

    // Fuzzy matchers:
    // - One for master sensory dimensions
    // - One for user's specific problematic triggers
    const masterMatcher = createFuzzyMatcher(
        normalizedMaster,
        [{ name: "normalizedName", weight: 1.0 }],
        { threshold: 0.38 }
    );

    const triggerMatcher = createFuzzyMatcher(
        normalizedTriggers,
        [{ name: "normalizedName", weight: 1.0 }],
        { threshold: 0.38 }
    );

    const conflictingTraits = [];
    const matchingTraits = [];
    const unrecognizedTags = [];

    // Helper: checks if tag matches an entry via direct substring or fuzzy
    function matchEntry(normalizedTag, matcher, itemsList) {
        // Direct substring or exact
        const direct = itemsList.find(item => 
            item.normalizedName === normalizedTag ||
            (normalizedTag.length >= 3 && item.normalizedName.includes(normalizedTag)) ||
            (item.normalizedName.length >= 3 && normalizedTag.includes(item.normalizedName))
        );
        if (direct) return direct;

        // Fuzzy match
        const res = matcher.search(normalizedTag);
        if (res && res.length > 0 && res[0].score <= 0.38) {
            return res[0].item;
        }
        return null;
    }

    for (const rawTag of rawTags) {
        if (!rawTag || typeof rawTag !== "string") continue;

        const normalizedTag = normalizeString(rawTag);
        if (!normalizedTag || normalizedTag.length < 2) {
            unrecognizedTags.push(rawTag);
            continue;
        }

        // Check if tag maps to master sensory dimensions
        const matchedMaster = matchEntry(normalizedTag, masterMatcher, normalizedMaster);

        // Check if tag conflicts with user's triggers
        const matchedTrigger = matchEntry(normalizedTag, triggerMatcher, normalizedTriggers);

        if (matchedTrigger) {
            conflictingTraits.push({
                tag: rawTag,
                matchedTrigger: matchedTrigger.originalName,
                note: `Kullanıcının '${matchedTrigger.originalName}' tetikleyicisi ile çakışıyor.`
            });
        } else if (matchedMaster) {
            // Valid recognized sensory tag and not a trigger for the user
            matchingTraits.push(rawTag);
        } else {
            // Neither recognized as master nor matched user triggers
            unrecognizedTags.push(rawTag);
        }
    }

    const totalValidTags = rawTags.length;
    const recognizedCount = conflictingTraits.length + matchingTraits.length;
    const conflictCount = conflictingTraits.length;

    // Proportional fitScore calculation:
    // If none of the tags could be recognized at all, distinguish from a genuine perfect fit
    let fitScore = 100;
    let recommendation = "high_fit";

    if (recognizedCount === 0) {
        // All tags were unrecognized
        fitScore = 70;
        recommendation = "unrecognized_traits";
    } else {
        // Proportional formula: fitScore = Math.round(100 - (conflictCount / totalValidTags * 100))
        const rawScore = Math.round(100 - (conflictCount / totalValidTags * 100));
        fitScore = Math.max(0, Math.min(100, rawScore));

        if (conflictCount === 0) {
            recommendation = "high_fit";
        } else if (fitScore >= 60) {
            recommendation = "moderate_fit";
        } else {
            recommendation = "low_fit";
        }
    }

    let message = "";
    if (recommendation === "high_fit") {
        message = `'${foodName}', kullanıcının bilinen duyusal tetikleyicileriyle yüksek düzeyde uyumlu görünüyor.`;
    } else if (recommendation === "moderate_fit") {
        message = `'${foodName}', kullanıcının duyusal profiliyle kısmi çakışma gösteriyor (${conflictingTraits.map(c => c.matchedTrigger).join(", ")}). Dokusal modifikasyon önerilebilir.`;
    } else if (recommendation === "low_fit") {
        message = `'${foodName}', kullanıcının kaçındığı birden fazla duyusal özellik barındırıyor (${conflictingTraits.map(c => c.matchedTrigger).join(", ")}). Daha nazik bir alternatif veya belirgin doku değişimi önerilebilir.`;
    } else {
        message = `'${foodName}' için sağlanan etiketler standart duyusal boyutlarla tam eşleştirilemedi, genel rehberlik sunulabilir.`;
    }

    return {
        status: "success",
        user_authenticated: true,
        foodName: foodName,
        fitScore: fitScore,
        recommendation: recommendation,
        conflictingTraits: conflictingTraits,
        matchingTraits: matchingTraits,
        unrecognizedTags: unrecognizedTags,
        message: message
    };
}

module.exports = {
    toolDeclaration,
    execute: calculateSensoryFit
};
