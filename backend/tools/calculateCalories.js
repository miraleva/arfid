/**
 * Tool: calculateCalories
 * Calculates total and itemized calories from a list of ingredients.
 */

const { calorieDatabase } = require("./data/calorieDatabase");

const toolDeclaration = {
    name: "calculateCalories",
    description: "Verilen malzeme listesi, miktarları ve birimlerine göre toplam kalori ve malzeme bazlı kalori dökümünü hesaplar. Kullanıcı kalori veya besin değeri hesabı istediğinde kullanılır.",
    parameters: {
        type: "object",
        properties: {
            ingredients: {
                type: "array",
                description: "Hesaplanacak malzeme listesi",
                items: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Malzemenin adı (örn. 'muz', 'tavuk göğsü', 'yulaf ezmesi', 'süt')"
                        },
                        amount: {
                            type: "number",
                            description: "Malzemenin miktarı (örn. 1, 100, 2)"
                        },
                        unit: {
                            type: "string",
                            description: "Birim (örn. 'gram', 'g', 'ml', 'adet', 'dilim', 'yemek kaşığı', 'tatlı kaşığı', 'su bardağı', 'kase')"
                        }
                    },
                    required: ["name", "amount"]
                }
            }
        },
        required: ["ingredients"]
    }
};

/**
 * Normalizes strings for alias matching
 */
function normalizeName(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

/**
 * Finds a matching food entry in the calorie database
 */
function findFoodMatch(rawName) {
    const normalized = normalizeName(rawName);
    if (!normalized) return null;

    // 1. Exact match with ID or Name
    let match = calorieDatabase.find(f => normalizeName(f.id) === normalized || normalizeName(f.name) === normalized);
    if (match) return match;

    // 2. Alias match
    match = calorieDatabase.find(f => f.aliases.some(a => normalizeName(a) === normalized));
    if (match) return match;

    // 3. Substring / partial match
    match = calorieDatabase.find(f => f.aliases.some(a => {
        const normA = normalizeName(a);
        return normalized.includes(normA) || normA.includes(normalized);
    }));

    return match || null;
}

/**
 * Normalizes units to weight in grams
 */
function convertToGrams(amount, unit, food) {
    const normUnit = (unit || "").toLowerCase().trim();

    // Standard metric units
    if (normUnit === "gram" || normUnit === "g" || normUnit === "gr") {
        return amount;
    }
    if (normUnit === "kg" || normUnit === "kilogram") {
        return amount * 1000;
    }
    if (normUnit === "ml" || normUnit === "mililitre") {
        const density = food.unitGrams || 1.0;
        return amount * density;
    }
    if (normUnit === "litre" || normUnit === "l" || normUnit === "lt") {
        const density = food.unitGrams || 1.0;
        return amount * 1000 * density;
    }

    // Portion / household units
    if (normUnit === "adet" || normUnit === "tane" || normUnit === "piece" || normUnit === "") {
        return amount * (food.servingGrams || 100);
    }
    if (normUnit.includes("dilim") || normUnit.includes("slice")) {
        return amount * (food.servingGrams || 30);
    }
    if (normUnit.includes("yemek kasigi") || normUnit.includes("corba kasigi") || normUnit.includes("tbsp") || normUnit.includes("yemek kaşığı")) {
        return amount * (food.servingGrams || 15);
    }
    if (normUnit.includes("tatli kasigi") || normUnit.includes("tsp") || normUnit.includes("tatlı kaşığı")) {
        return amount * (food.servingGrams ? Math.round(food.servingGrams / 2.5) : 5);
    }
    if (normUnit.includes("su bardagi") || normUnit.includes("bardak") || normUnit.includes("cup") || normUnit.includes("su bardağı")) {
        return amount * (food.unitGrams ? 200 * food.unitGrams : 200);
    }
    if (normUnit.includes("kase") || normUnit.includes("bowl")) {
        return amount * (food.servingGrams || 200);
    }
    if (normUnit.includes("avuc") || normUnit.includes("avuç")) {
        return amount * (food.servingGrams || 30);
    }

    // Default fallback to serving grams or raw amount assuming grams
    return amount * (food.servingGrams || 100);
}

/**
 * Calculates total and itemized calories from ingredients
 * 
 * @param {Object} args - Function arguments
 * @param {Array<{name: string, amount: number, unit?: string}>} args.ingredients
 * @returns {Promise<Object>} Calculated calorie summary
 */
async function calculateCalories(args) {
    if (!args || !Array.isArray(args.ingredients) || args.ingredients.length === 0) {
        return {
            status: "error",
            message: "Hesaplama için en az bir malzeme ve miktar belirtilmelidir.",
            total_calories: 0,
            items: [],
            unmatched: []
        };
    }

    let totalCalories = 0;
    const items = [];
    const unmatched = [];

    for (const ing of args.ingredients) {
        if (!ing || !ing.name) continue;

        const rawAmount = typeof ing.amount === "number" ? ing.amount : parseFloat(ing.amount);
        const amount = isNaN(rawAmount) || rawAmount <= 0 ? 1 : rawAmount;
        const unit = ing.unit || "adet";

        const food = findFoodMatch(ing.name);

        if (!food) {
            unmatched.push({
                requested_name: ing.name,
                amount: amount,
                unit: unit,
                reason: "Veritabanında eşleşen gıda bulunamadı."
            });
            continue;
        }

        const calculatedGrams = convertToGrams(amount, unit, food);
        const itemCalories = Math.round((calculatedGrams * food.caloriesPer100g) / 100);

        totalCalories += itemCalories;

        items.push({
            name: ing.name,
            matched_food: food.name,
            amount: amount,
            unit: unit,
            estimated_grams: Math.round(calculatedGrams),
            calories: itemCalories,
            note: food.note || null
        });
    }

    return {
        status: "success",
        total_calories: totalCalories,
        items_count: items.length,
        items: items,
        unmatched_count: unmatched.length,
        unmatched: unmatched,
        disclaimer: "Hesaplanan değerler ortalama porsiyon ve standart ürün değerlerine göre yaklaşık olarak hesaplanmıştır."
    };
}

module.exports = {
    toolDeclaration,
    execute: calculateCalories
};
