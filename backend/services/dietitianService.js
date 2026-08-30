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
async function getDietitianResponse(userText, userId) {
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

    // 1.1 Fetch Recent Chat Context
    let recentChatContext = "";
    if (userId) {
        try {
            const recentMessages = await chatRepository.getRecentMessages(userId, 10);
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

        // 3. Round 1: Check if Gemini requests a tool call (with tools enabled)
        const initialResponse = await geminiRawCall(systemPrompt, {
            tools: [{ functionDeclarations }]
        });

        const functionCalls = initialResponse.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            console.log(`[Dietitian Service] Tool call requested by Gemini (${functionCalls.length} calls)`);

            // Execute requested tools safely
            const toolExecutionResults = [];
            for (const call of functionCalls) {
                const toolName = call.name;
                const toolArgs = call.args || {};
                const executionOutput = await executeTool(toolName, toolArgs);
                toolExecutionResults.push({
                    toolName,
                    args: toolArgs,
                    output: executionOutput
                });
            }

            // Round 2 (Final Generation with Structured Output Schema and Tool Results)
            const finalPrompt = `
${systemPrompt}

TOOL EXECUTION RESULTS (Use these exact calculations in your response):
${JSON.stringify(toolExecutionResults, null, 2)}
`;

            rawText = await geminiResponse(finalPrompt, jsonSchemaConfig);
        } else {
            // Model did not request any tools, get structured output directly
            if (initialResponse.text && initialResponse.text.trim().startsWith("{")) {
                rawText = initialResponse.text;
            } else {
                rawText = await geminiResponse(systemPrompt, jsonSchemaConfig);
            }
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

        // 5. Apply Memory Updates (if valid)
        if (parsedData && parsedData.memory_updates && userId) {
            try {
                await memoryRepository.applyMemoryUpdates(userId, parsedData.memory_updates, userText);
            } catch (memErr) {
                console.error("Memory update failed, but continuing:", memErr);
            }
        }

        const assistantResponse = parsedData.assistant_response || "Üzgünüm, cevabınızı işlerken bir sorun oluştu, tekrar deneyebilir misiniz?";

        // 6. Generate Patient Card (Call #2) - Skip if fallback occurred
        let patientCard = "";
        if (userId && !isFallback) {
            patientCard = await generatePatientCard(userId);
        }

        return {
            assistant_response: assistantResponse,
            patient_card: patientCard
        };

    } catch (error) {
        console.error("Dietitian Assistant Error:", error.message);
        let errorMsg = "I'm having trouble connecting to my knowledge base right now. Please try again later.";
        if (error.status === 429) {
            errorMsg = "I'm a bit overwhelmed right now. Please try again in a moment.";
        }
        return {
            assistant_response: errorMsg,
            patient_card: ""
        };
    }
}

module.exports = {
    getDietitianResponse,
    generatePatientCard
};
