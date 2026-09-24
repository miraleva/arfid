/**
 * Dietitian Service
 * Business logic coordinator for ARFID dietary consultations, patient card generation,
 * RAG retrieval, memory constraints, chat history, and Gemini Tool Use (Function Calling).
 */

const { geminiResponse, geminiRawCall } = require("./aiService");
const memoryRepository = require("../repositories/memoryRepository");
const chatRepository = require("../repositories/chatRepository");
const { buildSystemPrompt, jsonSchemaConfig } = require("../promptBuilder");
const { getRagContext } = require("../rag/ragClient");
const { functionDeclarations, executeTool } = require("../tools");
const openFoodFactsService = require("./openFoodFactsService");

/**
 * Generates a short "Patient Card" summary using a second Gemini call.
 * This runs AFTER memory updates to reflect the latest state.
 * 
 * @param {number} userId - Target user ID
 * @returns {Promise<string>} Short patient card text
 */
async function generatePatientCard(userId) {
    if (!userId) return "";

    try {
        // 1. Re-fetch fresh constraints (including just-added ones)
        const memoryContext = await memoryRepository.getUserConstraints(userId);

        if (!memoryContext || memoryContext.trim() === "") {
            return "No specific dietary constraints recorded yet.";
        }

        // 2. Short, strict prompt for summary
        const summaryPrompt = `
        You are summarizing a patient's dietary profile for a quick-view card.
        Based ONLY on the following constraints, create a very short summary (max 400 chars).
        
        CONSTRAINTS:
        ${memoryContext}

        REQUIREMENTS:
        - Bullet points or single paragraph.
        - Mention Unsafe Foods (AVOID), Triggers, and Conditions.
        - Be clinical but clear.
        - NO introductory text.
        `;

        // 3. Call Gemini (Lightweight call)
        const summary = await geminiResponse(summaryPrompt);
        return summary.trim();

    } catch (e) {
        console.error("Patient Card Generation Failed:", e);
        return ""; // Fail gracefully, don't crash chat
    }
}

/**
 * Main coordinator function that processes user messages, queries RAG,
 * resolves Gemini Tool Calls (max 2 rounds), generates structured dietitian responses,
 * and applies memory updates.
 * 
 * @param {string} userText - User message
 * @param {number} [userId] - Optional user ID for logged-in sessions
 * @returns {Promise<import('../types').DietitianResult>}
 */
async function getDietitianResponse(userText, userId, conversationId = null) {
    // 1. Fetch User Memory Context & Master Lists for Semantic Mapping
    let memoryContext = "";
    let masterLists = { foods: [], sensory: [], conditions: [] };

    try {
        if (userId) {
            memoryContext = await memoryRepository.getUserConstraints(userId);
        }
        masterLists = await memoryRepository.getMasterLists();
    } catch (err) {
        console.error("Error fetching context/lists:", err);
    }

    // 1.1 Fetch Recent Chat Context (Scoped to conversationId)
    let recentChatContext = "";
    if (conversationId) {
        try {
            const recentMessages = await chatRepository.getRecentMessages(conversationId, 10);
            if (recentMessages && recentMessages.length > 0) {
                recentChatContext = "RECENT CHAT (last 10):\n" +
                    recentMessages.map(m => {
                        const content = m.content.length > 300 ? m.content.substring(0, 300) + "..." : m.content;
                        return `${m.role}: ${content}`;
                    }).join("\n");
            }
        } catch (histErr) {
            console.error("Error fetching recent messages:", histErr);
        }
    }

    // 1.2 Fetch RAG Context (Knowledge Base)
    const ragContext = await getRagContext(userText);

    // 2. Construct System Prompt
    const systemPrompt = buildSystemPrompt({
        userText,
        masterLists,
        memoryContext,
        ragContext,
        recentChatContext
    });

    try {
        let rawText = "";
        let capturedWidget = null;
        const accumulatedToolResults = [];
        const MAX_TOOL_ROUNDS = 2; // Up to 2 rounds (e.g. Round 1: calculateCalories, Round 2: presentAsWidget)
        let toolRound = 0;
        let currentPrompt = systemPrompt;

        // 3. Multi-turn Tool Calling Loop
        while (toolRound < MAX_TOOL_ROUNDS) {
            const toolCallResponse = await geminiRawCall(currentPrompt, {
                tools: [{ functionDeclarations }]
            });

            const functionCalls = toolCallResponse.functionCalls;

            if (!functionCalls || functionCalls.length === 0) {
                // No tool call requested in this round
                if (toolCallResponse.text && toolCallResponse.text.trim().startsWith("{")) {
                    rawText = toolCallResponse.text;
                }
                break;
            }

            toolRound++;
            console.log(`[Dietitian Service] Tool round ${toolRound} requested by Gemini (${functionCalls.length} calls)`);

            for (const call of functionCalls) {
                const toolName = call.name;
                const toolArgs = call.args || {};
                const executionOutput = await executeTool(toolName, toolArgs, { userId });

                accumulatedToolResults.push({
                    toolName,
                    args: toolArgs,
                    output: executionOutput
                });

                if (toolName === "presentAsWidget" && executionOutput.status === "success") {
                    capturedWidget = executionOutput.widget;
                }
            }

            // If a presentation widget has already been captured, or if max rounds reached, break
            if (capturedWidget || toolRound >= MAX_TOOL_ROUNDS) {
                break;
            }

            // Chaining prompt for the next round (allows Gemini to use calculation results to present a widget)
            currentPrompt = `
${systemPrompt}

TOOL EXECUTION RESULTS FROM PREVIOUS ROUND:
${JSON.stringify(accumulatedToolResults, null, 2)}

INSTRUCTION FOR NEXT STEP:
You now have the verified calculation results above. If presenting a nutritional summary or recipe, call 'presentAsWidget' now with these verified figures. Otherwise, formulate your final answer.
`;
        }

        // Final Structured Generation (Round 2 / Final Turn)
        if (!rawText) {
            const finalPrompt = `
${systemPrompt}

TOOL EXECUTION RESULTS (Use these exact verified calculations in your response):
${JSON.stringify(accumulatedToolResults, null, 2)}
`;
            rawText = await geminiResponse(finalPrompt, jsonSchemaConfig);
        }

        // 4. Direct JSON Parsing with Defensive Fallback
        let parsedData;
        let isFallback = false;
        try {
            parsedData = JSON.parse(rawText);
        } catch (parseError) {
            console.error("JSON Parse Error on Native Output:", parseError);
            console.log("Raw Gemini Output was:", rawText);
            isFallback = true;
            parsedData = {
                assistant_response: "Üzgünüm, cevabınızı işlerken bir sorun oluştu, tekrar deneyebilir misiniz?",
                memory_updates: { foods: [], sensory: [], conditions: [] }
            };
        }

        // 5. Apply Memory Updates (Kullanıcının kendi beyanları olduğu için ihlal durumunda dahi güvenle işlenir)
        if (parsedData && parsedData.memory_updates && userId) {
            try {
                await memoryRepository.applyMemoryUpdates(userId, parsedData.memory_updates, userText);
            } catch (memErr) {
                console.error("Memory update failed, but continuing:", memErr);
            }
        }

        let assistantResponse = (parsedData.assistant_response || "Üzgünüm, cevabınızı işlerken bir sorun oluştu, tekrar deneyebilir misiniz?").trim();

        // 6. Generate Patient Card (Call #2) - Skip if fallback occurred
        let patientCard = "";
        if (userId && !isFallback) {
            patientCard = await generatePatientCard(userId);
        }

        // 7. Background Enrichment: Open Food Facts Image Lookup (Non-blocking fallback)
        if (capturedWidget) {
            try {
                capturedWidget = await openFoodFactsService.enrichWidget(capturedWidget);
            } catch (enrichErr) {
                console.warn("[DietitianService] Widget enrichment skipped due to error:", enrichErr.message);
            }
        }

        return {
            assistant_response: assistantResponse,
            patient_card: patientCard,
            widget: capturedWidget
        };

    } catch (error) {
        console.error("Dietitian Assistant Error:", error.message);
        let errorMsg = "I'm having trouble connecting to my knowledge base right now. Please try again later.";
        if (error.status === 429) {
            errorMsg = "I'm a bit overwhelmed right now. Please try again in a moment.";
        }
        return {
            assistant_response: errorMsg,
            patient_card: "",
            widget: null
        };
    }
}

module.exports = {
    getDietitianResponse,
    generatePatientCard
};
