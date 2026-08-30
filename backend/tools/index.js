/**
 * Tools Registry
 * Aggregates all tool declarations and handles safe execution with error catching.
 */

const calculateCalories = require("./calculateCalories");

// List of all tool definitions
const tools = [
    calculateCalories
];

// Gemini SDK compatible functionDeclarations list
const functionDeclarations = tools.map(t => t.toolDeclaration);

/**
 * Safely executes a tool by name with provided arguments.
 * Catches missing tool errors, parameter validation errors, and runtime exceptions.
 * 
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Arguments passed from Gemini model
 * @returns {Promise<Object>} Safe result payload for Gemini tool response
 */
async function executeTool(toolName, args = {}) {
    console.log(`[Tool Registry] Executing tool: ${toolName} with args:`, JSON.stringify(args));

    // (a) Gemini'nin tanımlı olmayan bir tool adı çağırmasını güvenle yakalama
    const tool = tools.find(t => t.toolDeclaration.name === toolName);
    if (!tool) {
        console.warn(`[Tool Registry] Tool '${toolName}' is not defined.`);
        return {
            status: "error",
            error_code: "TOOL_NOT_FOUND",
            message: `Araç '${toolName}' sistemde tanımlı değil. Lütfen mevcut araçları kullanın veya doğrudan cevap verin.`
        };
    }

    try {
        // (b) Eksik/hatalı tipte parametre gönderilmesini güvenle yakalama
        if (typeof args !== "object" || args === null) {
            return {
                status: "error",
                error_code: "INVALID_ARGUMENTS",
                message: "Araca geçersiz parametre formatı sağlandı. Parametre bir nesne olmalıdır."
            };
        }

        const result = await tool.execute(args);
        return result;
    } catch (execError) {
        console.error(`[Tool Registry] Error while executing ${toolName}:`, execError);
        return {
            status: "error",
            error_code: "EXECUTION_FAILED",
            message: `Araç çalıştırılırken bir hata oluştu: ${execError.message}`
        };
    }
}

module.exports = {
    functionDeclarations,
    executeTool,
    geminiToolsConfig: [{ functionDeclarations }]
};
