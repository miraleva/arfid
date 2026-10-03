/**
 * 5. Embedding Tutarlılık Testi
 * Aynı metin iki kez embed edildiğinde dönen vektörlerin cosine similarity'si > 0.999 olmalıdır.
 * Bu, embedding modelinin deterministik çalıştığının kanıtıdır.
 */

const { RAG_SERVICE_URL, createCategoryTracker, runStandalone } = require("./_shared");

async function testEmbeddingConsistency() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 5. Embedding Tutarlılık Testi (Deterministik Vektör Doğrulama)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("5. Embedding Tutarlılık");

    const sampleText = "elma tarifi";

    try {
        const body = JSON.stringify({ text: sampleText });

        const [r1, r2] = await Promise.all([
            fetch(`${RAG_SERVICE_URL}/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body
            }).then(r => r.json()),
            fetch(`${RAG_SERVICE_URL}/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body
            }).then(r => r.json())
        ]);

        const v1 = r1.embedding;
        const v2 = r2.embedding;

        if (!Array.isArray(v1) || !Array.isArray(v2) || v1.length === 0 || v1.length !== v2.length) {
            tracker.record(false, "Vektör Boyutu Kontrolü", "Vektörler geçerli bir dizi olarak dönmedi");
            return tracker.summarize();
        }

        tracker.record(true, `Vektör Boyut Uyumu (${v1.length}D)`, `Model: all-MiniLM-L6-v2`);

        // Cosine similarity hesaplama
        let dot = 0, norm1 = 0, norm2 = 0;
        for (let i = 0; i < v1.length; i++) {
            dot += v1[i] * v2[i];
            norm1 += v1[i] * v1[i];
            norm2 += v2[i] * v2[i];
        }
        const cosineSim = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));

        const isDeterministic = cosineSim >= 0.9999;
        tracker.record(
            isDeterministic,
            `Deterministik Tutarlılık (Cosine Similarity >= 0.999)`,
            `Hesaplanan Cosine Similarity: ${cosineSim.toFixed(8)} (%${(cosineSim * 100).toFixed(4)})`
        );

    } catch (err) {
        tracker.record(false, "Embedding Tutarlılık Testi", `Hata: ${err.message}`);
    }

    return tracker.summarize();
}

if (require.main === module) {
    runStandalone(testEmbeddingConsistency);
}

module.exports = testEmbeddingConsistency;
