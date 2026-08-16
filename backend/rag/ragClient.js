/**
 * RAG Client Module
 * Handles contextual filtering, HTTP retrieval with timeout, and formatting of recipe/book context.
 */

const { shouldTriggerRag } = require("./ragFilter");

/**
 * Fetches relevant recipe and knowledge base context for a user query via RAG service.
 * 
 * @param {string} userText - User message text
 * @returns {Promise<string>} Formatted RAG context string or empty string on failure/non-trigger
 */
async function getRagContext(userText) {
    if (!shouldTriggerRag(userText)) {
        console.log("[RAG] Mesaj genel sohbet niteliğinde, RAG sorgusu atlanıyor.");
        return "";
    }

    console.log("[RAG] Mesaj yemek/tarif bağlamı içeriyor, retrieval sorgulanıyor...");

    const ragServiceUrl = process.env.RAG_SERVICE_URL || "http://localhost:5001";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const ragResponse = await fetch(`${ragServiceUrl}/retrieve`, {

            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: userText, top_k: 4 }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (ragResponse.ok) {
            const ragData = await ragResponse.json();
            if (ragData.chunks && ragData.chunks.length > 0) {
                const summaryList = ragData.chunks.map((c, i) => `Chunk ${i + 1}: ${c.source} (Sayfa ${c.page_number || 'Bilinmiyor'})`).join(" | ");
                console.log(`[RAG] ${ragData.chunks.length} ilgili chunk bulundu -> ${summaryList}`);

                if (process.env.DEBUG_RAG === "true") {
                    console.log("[RAG DEBUG] Chunk içerikleri:", JSON.stringify(ragData.chunks, null, 2));
                }
                return "İLGİLİ TARİF / KİTAP BİLGİSİ (RAG Context):\n" +
                    ragData.chunks.map((c, i) => {
                        const pageInfo = c.page_number ? `, Sayfa: ${c.page_number}` : "";
                        return `[Chunk ${i + 1} - Kaynak: ${c.source}${pageInfo}]\n${c.text}`;
                    }).join("\n\n");
            }
        }
        return "";
    } catch (ragErr) {
        clearTimeout(timeoutId);
        if (ragErr.name === "AbortError") {
            console.error("[RAG] Retrieval request timed out (3s limit reached), continuing without RAG context.");
        } else {
            console.error("[RAG] Service unavailable, continuing without RAG context:", ragErr.message);
        }
        return "";
    }
}

module.exports = {
    getRagContext
};
