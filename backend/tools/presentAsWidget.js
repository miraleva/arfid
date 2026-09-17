/**
 * Tool: presentAsWidget
 * Formats recipe suggestions or nutritional/calorie breakdowns into structured presentation widgets.
 * Used exclusively when a concrete recipe is provided or specific nutrition/calories are explained.
 */

const toolDeclaration = {
    name: "presentAsWidget",
    description: "Kullanıcıya sunulacak bir yemek/içecek tarifini ('recipe') veya bir yiyeceğin hesaplanmış kalori/besin dökümünü ('nutrition') zengin bir widget kartı olarak biçimlendirir. YALNIZCA somut bir tarif önerildiğinde veya kalori/besin değeri açıklandığında çağrılmalıdır.",
    parameters: {
        type: "object",
        properties: {
            widget_type: {
                type: "string",
                enum: ["recipe", "nutrition"],
                description: "Sunulacak widget kartının tipi: 'recipe' (yemek tarifi) veya 'nutrition' (besin/kalori dökümü)"
            },
            title: {
                type: "string",
                description: "Kartın kullanıcıya görünen ana başlığı (örn: 'Fırında Çıtır Patates Dilimleri' veya 'Izgara Tavuk Göğsü Besin Değeri')"
            },
            recipe_data: {
                type: "object",
                description: "Tarif kartı için gerekli detaylar (widget_type == 'recipe' ise zorunlu)",
                properties: {
                    display_mode: {
                        type: "string",
                        enum: ["single", "compact_list"],
                        description: "Tarif kartı modu: 'single' (tek detaylı kart) veya 'compact_list' (küçük alternatifler)"
                    },
                    prep_time_min: { type: "integer", description: "Hazırlık süresi (dakika)" },
                    cook_time_min: { type: "integer", description: "Pişirme süresi (dakika)" },
                    servings: { type: "string", description: "Porsiyon bilgisi (örn. '1-2 Kişilik')" },
                    calories_approx: { type: "integer", description: "Yaklaşık tahmini kalori (model tahmini, örn. 210)" },
                    is_verified_calories: { type: "boolean", description: "Kalori doğrulanmış bir kaynaktan mı geliyor (tarifler için daima false: tahmini)" },
                    sensory_tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "Duyusal doku etiketleri (örn: ['Çıtır', 'Kuru Doku', 'Hafif Tuzlu'])"
                    },
                    image_placeholder: {
                        type: "object",
                        properties: {
                            slot_key: { type: "string", description: "İleride API'den eşleşecek yemek anahtarı (örn. 'baked_potato')" },
                            alt_text: { type: "string", description: "Görsel açıklaması" }
                        }
                    },
                    ingredients: {
                        type: "array",
                        description: "Malzeme listesi",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Malzeme adı" },
                                amount: { type: "number", description: "Miktar" },
                                unit: { type: "string", description: "Birim (adet, gram, yemek kaşığı vb.)" }
                            },
                            required: ["name"]
                        }
                    },
                    instructions: {
                        type: "array",
                        items: { type: "string" },
                        description: "Adım adım hazırlanış rehberi"
                    },
                    dietitian_note: {
                        type: "string",
                        description: "ARFID hassasiyetleri ve doku modifikasyonları için diyetisyen tavsiyesi"
                    }
                }
            },
            nutrition_data: {
                type: "object",
                description: "Besin/kalori döküm kartı detayları (widget_type == 'nutrition' ise zorunlu)",
                properties: {
                    food_name: { type: "string", description: "Besinin adı (örn. 'Tavuk Göğsü')" },
                    amount_label: { type: "string", description: "Porsiyon/Miktar etiketi (örn. '150 gram')" },
                    total_calories: { type: "integer", description: "Doğrulanmış toplam kalori (calculateCalories sonucundan)" },
                    is_verified: { type: "boolean", description: "calculateCalories ile doğrulandığını belirtir (daima true)" },
                    macros: {
                        type: "object",
                        properties: {
                            protein_g: { type: "number", description: "Protein (gram)" },
                            carbs_g: { type: "number", description: "Karbonhidrat (gram)" },
                            fat_g: { type: "number", description: "Yağ (gram)" }
                        }
                    },
                    breakdown: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                item: { type: "string" },
                                calories: { type: "number" },
                                note: { type: "string" }
                            }
                        }
                    },
                    disclaimer: { type: "string", description: "Standart besin tablosu açıklaması" },
                    image_placeholder: {
                        type: "object",
                        properties: {
                            slot_key: { type: "string" },
                            alt_text: { type: "string" }
                        }
                    }
                }
            }
        },
        required: ["widget_type", "title"]
    }
};

/**
 * Validates and standardizes the widget payload passed by Gemini.
 * 
 * @param {Object} args - Tool arguments from Gemini
 * @param {Object} [context={}] - Invocation context
 * @returns {Promise<Object>} Formatted widget response
 */
async function presentAsWidget(args, context = {}) {
    if (!args || typeof args !== "object") {
        return {
            status: "error",
            error_code: "INVALID_ARGUMENTS",
            message: "Widget parametreleri eksik veya geçersiz."
        };
    }

    const { widget_type, title, recipe_data, nutrition_data } = args;

    if (!widget_type || !["recipe", "nutrition"].includes(widget_type)) {
        return {
            status: "error",
            error_code: "INVALID_WIDGET_TYPE",
            message: "widget_type 'recipe' veya 'nutrition' olmalıdır."
        };
    }

    if (!title || typeof title !== "string" || title.trim() === "") {
        return {
            status: "error",
            error_code: "MISSING_TITLE",
            message: "Widget için geçerli bir başlık belirtilmelidir."
        };
    }

    const normalizedWidget = {
        type: widget_type,
        title: title.trim(),
        created_at: Math.floor(Date.now() / 1000)
    };

    if (widget_type === "recipe") {
        if (!recipe_data || typeof recipe_data !== "object") {
            return {
                status: "error",
                error_code: "MISSING_RECIPE_DATA",
                message: "Tarif widget'ı için 'recipe_data' nesnesi gereklidir."
            };
        }

        normalizedWidget.data = {
            display_mode: recipe_data.display_mode || "single",
            prep_time_min: recipe_data.prep_time_min || null,
            cook_time_min: recipe_data.cook_time_min || null,
            servings: recipe_data.servings || "1 Kişilik",
            calories_approx: recipe_data.calories_approx || null,
            is_verified_calories: false, // Tariflerde kalori her zaman model tahminidir
            confidence_label: "Tahmini Değer (~)",
            sensory_tags: Array.isArray(recipe_data.sensory_tags) ? recipe_data.sensory_tags : [],
            image_placeholder: recipe_data.image_placeholder || {
                slot_key: "recipe_default",
                alt_text: title
            },
            ingredients: Array.isArray(recipe_data.ingredients) ? recipe_data.ingredients : [],
            instructions: Array.isArray(recipe_data.instructions) ? recipe_data.instructions : [],
            dietitian_note: recipe_data.dietitian_note || ""
        };
    } else if (widget_type === "nutrition") {
        if (!nutrition_data || typeof nutrition_data !== "object") {
            return {
                status: "error",
                error_code: "MISSING_NUTRITION_DATA",
                message: "Besin widget'ı için 'nutrition_data' nesnesi gereklidir."
            };
        }

        normalizedWidget.data = {
            food_name: nutrition_data.food_name || title,
            amount_label: nutrition_data.amount_label || "Standart porsiyon",
            total_calories: nutrition_data.total_calories || 0,
            is_verified: true, // calculateCalories doğrulamalı
            confidence_label: "Doğrulanmış Değer",
            macros: nutrition_data.macros || {
                protein_g: null,
                carbs_g: null,
                fat_g: null
            },
            breakdown: Array.isArray(nutrition_data.breakdown) ? nutrition_data.breakdown : [],
            disclaimer: nutrition_data.disclaimer || "Veritabanı hesaplama aracı (calculateCalories) ile doğrulanmış ortalama değerlerdir.",
            image_placeholder: nutrition_data.image_placeholder || {
                slot_key: "food_default",
                alt_text: nutrition_data.food_name || title
            }
        };
    }

    return {
        status: "success",
        message: "Widget başarıyla biçimlendirildi.",
        widget: normalizedWidget
    };
}

module.exports = {
    toolDeclaration,
    execute: presentAsWidget
};
