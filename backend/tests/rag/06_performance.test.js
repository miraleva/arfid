/**
 * 6. Performans / Zaman Testi
 * 5 farklı sorgu için roundtrip süreleri ölçülür, min/max/ort süre raporlanır.
 * 3 saniyelik timeout eşiğinin altında (< 3000ms) kaldığı doğrulanır.
 */

const { RAG_SERVICE_URL, createCategoryTracker, runStandalone } = require("./_shared");

async function testPerformanceAndLatency() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 6. Performans ve Gecikme Testi (Latency SLA & Roundtrip)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("6. Performans / Zaman");

    const benchmarkQueries = [
        "çocuklar için sebzeli tatlı tarifleri",
        "macaroni and cheese with butternut squash",
        "breakfast blueberry lemon muffins",
        "sweet potato pancakes recipe",
        "brownies with carrot and spinach puree"
    ];

    const durations = [];

    for (let i = 0; i < benchmarkQueries.length; i++) {
        const query = benchmarkQueries[i];
        const t0 = Date.now();
        try {
            const res = await fetch(`${RAG_SERVICE_URL}/retrieve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, top_k: 4 })
            });
            const t1 = Date.now();
            const elapsed = t1 - t0;
            durations.push(elapsed);

            const isOk = res.ok && elapsed < 3000;
            tracker.record(
                isOk,
                `Sorgu ${i + 1}: "${query.slice(0, 32)}..."`,
                `${elapsed}ms (SLA: < 3000ms)`
            );
        } catch (err) {
            tracker.record(false, `Sorgu ${i + 1}`, `Hata: ${err.message}`);
        }
    }

    if (durations.length > 0) {
        const minMs = Math.min(...durations);
        const maxMs = Math.max(...durations);
        const avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

        console.log(`\n  ⏱️  [METRİKLER] Min: ${minMs}ms | Max: ${maxMs}ms | Ortalama: ${avgMs}ms`);

        if (avgMs > 1000) {
            console.warn(`  ⚠️  [UYARI] Ortalama yanıt süresi (${avgMs}ms) 1000ms hedefinin üzerinde.`);
        }

        tracker.record(
            avgMs < 3000,
            `Ortalama Yanıt Süresi SLA Kontrolü (< 3000ms)`,
            `Ortalama: ${avgMs}ms`
        );
    }

    return tracker.summarize();
}

if (require.main === module) {
    runStandalone(testPerformanceAndLatency);
}

module.exports = testPerformanceAndLatency;
