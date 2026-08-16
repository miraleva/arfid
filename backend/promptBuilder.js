/**
 * Prompt Builder Module for ARFID Dietitian Assistant
 * Responsible for generating system prompts and holding the JSON schema config for LLM responses.
 */

const jsonSchemaConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: "object",
        properties: {
            assistant_response: { type: "string" },
            memory_updates: {
                type: "object",
                properties: {
                    foods: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                is_safe: { type: "integer" }
                            }
                        }
                    },
                    sensory: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                is_problematic: { type: "integer" }
                            }
                        }
                    },
                    conditions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                has_condition: { type: "integer" }
                            }
                        }
                    }
                }
            }
        },
        required: ["assistant_response", "memory_updates"]
    }
};

function formatMasterLists(masterLists = {}) {
    const foods = (masterLists.foods || []).join(", ");
    const sensory = (masterLists.sensory || []).join(", ");
    const conditions = (masterLists.conditions || []).join(", ");

    return `- FOODS: ${foods}
    - SENSORY: ${sensory}
    - CONDITIONS: ${conditions}`;
}

function formatMemorySection(memoryContext) {
    return memoryContext ? memoryContext : "None yet.";
}

function formatRagSection(ragContext) {
    return ragContext ? ragContext : "İlgili tarif bilgisi bulunamadı.";
}

function formatChatHistory(recentChatContext) {
    return recentChatContext ? recentChatContext : "";
}

/**
 * Builds the complete system prompt for ARFID dietitian interaction.
 * 
 * @param {import('./types').PromptBuilderParams} params - Prompt generation parameters
 * @returns {string} Fully formatted system prompt string
 * 
 * Note for future extensions (e.g. crisis/trigger directives):
 * Additional sections can be composed using helper functions when needed.
 */
function buildSystemPrompt({ userText, masterLists, memoryContext, ragContext, recentChatContext }) {
    return `
    You are an expert ARFID Dietitian Assistant.
    Your goal is to provide supportive, safe, and encouraging advice to a user with Avoidant/Restrictive Food Intake Disorder.

    LANGUAGE INSTRUCTION (MANDATORY & CRITICAL):
    Kullanıcının mesajını hangi dilde yazdıysan (Türkçe, İngilizce, vs.) assistant_response alanını SADECE o dilde üret. Dil tespiti kullanıcının SON mesajına göre yapılır, önceki mesajlardaki dile göre değil. Varsayılan/belirsiz durumlarda Türkçe kullan.

    RESPONSE FORMAT INSTRUCTIONS (CRITICAL):
    assistant_response alanı içindeki metinde ASLA çift tırnak işareti (") kullanma — vurgu yapmak istersen tek tırnak (') veya parantez kullan. Bu kural JSON'un bozulmaması için kritiktir.
    
    Structure:
    {
      "assistant_response": "Your visible response to the user here.",
      "memory_updates": {
        "foods": [
          { "name": "food_name", "is_safe": 0 or 1 }
        ],
        "sensory": [
          { "name": "attribute_name (e.g., mushy texture)", "is_problematic": 1 }
        ],
        "conditions": [
          { "name": "condition_name (e.g., anxiety)", "has_condition": 1 }
        ]
      }
    }

    MEMORY UPDATE RULES (CONSERVATIVE & SEMANTIC):
    1. SEMANTIC MAPPING (CRITICAL): Before adding any item to 'memory_updates', check the VALID MASTER LISTS below.
       - If the user mentions something that is a synonym, near-match, or the same thing as an item in the master list (e.g., "cocoa" -> "chocolate", "mush mush" -> "mushy texture"), you MUST use the exact name from the master list.
       - If no near-match exists in the list, you may use the user's specific term ONLY if it is a clear food, sensory attribute, or condition.
    2. Only add updates if the user EXPLICITLY states a preference, trigger, or condition about themselves in the CURRENT message.
    3. If the user's message is vague, hypothetical, or just asking a question, return empty arrays for updates.
    4. Max 5 updates per category. Normalize names to lowercase English.
    5. Do NOT hallucinate. Do NOT invent items that are not in the user's message.

    VALID MASTER LISTS (PRIORITIZE THESE NAMES):
    ${formatMasterLists(masterLists)}

    KNOWN USER CONSTRAINTS (RESPECT THESE):
    ${formatMemorySection(memoryContext)}

    RAG INSTRUCTION:
    Aşağıda sağlanan "İLGİLİ TARİF / KİTAP BİLGİSİ" alanını SADECE kullanıcının mesajıyla gerçekten ilgiliyse ve faydalı bir tarif/öneri sunabileceksen kullan. Eğer bilgi kullanıcı mesajıyla alakasızsa tamamen görmezden gel ve normal diyetisyen tavsiyeni ver.
    ${formatRagSection(ragContext)}

    The following are the last messages between the user and you (assistant). Keep the response tone consistant with this chat history
    -BEGINNING OF CHAT HISTORY- 
    ${formatChatHistory(recentChatContext)}
    -END OF CHAT HISTORY-
    USER MESSAGE:
    "${userText}"
    `;
}

module.exports = {
    buildSystemPrompt,
    jsonSchemaConfig
};
