/**
 * ARFID RAG Contextual Trigger Filter
 * Determines whether a user message requires Knowledge Base / Recipe retrieval.
 */

// Türkçe ve İngilizce kelime/kök listesi (Kelime sınırı veya kesin eşleşme için)
const FOOD_KEYWORDS = [
    // Türkçe Yemek / Malzeme / Eylem Kökleri
    "tarif", "yemek", "yiyecek", "besin", "öğün", "kahvaltı", "öğle yemeği", "akşam yemeği", 
    "atıştırmalık", "pişir", "pişirme", "haşla", "kızart", "fırın", "malzeme", 
    "içerik", "içeren", "doku", "tatlı", "tuzlu", "ekşi", "çorba", 
    "sebze", "meyve", "et", "tavuk", "balık", "ekmek", "makarna", "pilav", "pirinç",
    "krep", "püre", "sos", "smoothie", "salata", "porsiyon", "diyet",

    // İngilizce Food / Ingredient / Action Keywords
    "recipe", "food", "meal", "eat", "eating", "cook", "cooking", "bake", "baking",
    "breakfast", "lunch", "dinner", "snack", "ingredient", "dish", "dishes",
    "texture", "taste", "sweet", "salty", "soup", "vegetable", "fruit",
    "meat", "chicken", "fish", "bread", "pasta", "rice", "smoothie", "salad"
];

// Niyet / Soru Kalıpları (Phrases & Patterns)
const INTENT_PATTERNS = [
    // Türkçe Soru / Öneri Kalıpları
    /ne\s+(pişir|yiy|yap)/i,           // "ne pişirsem", "ne yiyebilirim", "ne yapabilirim"
    /nasıl\s+yapılır/i,               // "nasıl yapılır", "krep nasıl yapılır"
    /öneri(si)?\s+(ver|var\s*mı)/i,    // "öneri ver", "tarif önerisi var mı"
    /tarif(i)?\s+(ver|var\s*mı|öner)/i,// "tarif ver", "tarif öner"
    /neler\s+(yiyebilirim|yapabilirim)/i,

    // İngilizce Intent Patterns
    /how\s+(do\s+i|to)\s+(make|cook|prepare)/i, // "how do I make", "how to cook"
    /what\s+can\s+i\s+(cook|eat|make)/i,        // "what can I cook with", "what can I eat"
    /suggest\s+(a\s+)?(dish|recipe|meal|food)/i,// "suggest a dish", "suggest recipe"
    /give\s+me\s+(a\s+)?recipe/i,               // "give me a recipe"
    /cook\s+with/i                              // "cook with X"
];

/**
 * Checks if the message contains food/recipe context warranting a RAG query.
 * @param {string} text - User message
 * @returns {boolean}
 */
function shouldTriggerRag(text) {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase();

    // 1. Regex desen kontrolü
    for (const pattern of INTENT_PATTERNS) {
        if (pattern.test(lower)) {
            return true;
        }
    }

    // 2. Anahtar kelime kontrolü (Kelime/kök eşleşmesi)
    for (const kw of FOOD_KEYWORDS) {
        // Çok heceli tam ifadeler ("öğle yemeği", "akşam yemeği") veya kökler
        if (kw.includes(" ")) {
            if (lower.includes(kw)) return true;
        } else {
            const regex = new RegExp(`(^|[\\s.,!?;:])${kw}`, "i");
            if (regex.test(lower)) {
                return true;
            }
        }
    }

    return false;
}

module.exports = {
    shouldTriggerRag,
    FOOD_KEYWORDS,
    INTENT_PATTERNS
};
