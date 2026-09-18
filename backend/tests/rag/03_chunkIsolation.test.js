/**
 * 3. Chunk Karıştırma / Ayrım Testi (Discrimination & Isolation)
 * Birbirine yakın konudaki 2 farklı tarifin (örn. Macaroni 1 vs Macaroni 2)
 * ayırt edici detaylar üzerinden birbirine karışmadan kendi doğru chunk'larını getirdiği doğrulanır.
 */

const { RAG_SERVICE_URL, createCategoryTracker, runStandalone } = require("./_shared");

async function testChunkDiscrimination() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 3. Chunk Karıştırma / Ayrım Testi (Komşu Tarif İzolasyonu)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("3. Chunk Karıştırma / Ayrım");

    // Sayfa 111: Macaroni and Cheese 1 (Butternut Squash / Cauliflower)
    // Sayfa 115: Macaroni and Cheese 2 (White beans / Chickpeas / Navy beans)
    const queryA = "Macaroni and cheese recipe incorporating yellow butternut squash or cauliflower puree";
    const queryB = "Macaroni and cheese recipe with canned white beans, navy beans or chickpeas for extra protein";

    try {
        const [resA, resB] = await Promise.all([
            fetch(`${RAG_SERVICE_URL}/retrieve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryA, top_k: 4 })
            }).then(r => r.json()),
            fetch(`${RAG_SERVICE_URL}/retrieve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryB, top_k: 4 })
            }).then(r => r.json())
        ]);

        const topPageA = resA.chunks?.[0]?.page_number;
        const topPageB = resB.chunks?.[0]?.page_number;

        // Query A must prioritize Page 111
        const passA = topPageA === 111;
        tracker.record(
            passA,
            "Sorgu A: Butternut Squash Macaroni -> Sayfa 111'e yönlendi",
            `Top-1 Sayfa: ${topPageA} (Beklenen: 111)`
        );

        // Query B must prioritize Page 115
        const passB = topPageB === 115;
        tracker.record(
            passB,
            "Sorgu B: Beans/Chickpeas Macaroni -> Sayfa 115'e yönlendi",
            `Top-1 Sayfa: ${topPageB} (Beklenen: 115)`
        );

        // Discrimination check: They should not map to the same top recipe
        const noCrossContamination = topPageA !== topPageB && passA && passB;
        tracker.record(
            noCrossContamination,
            "Komşu Tarif Ayrımı (No Cross-Contamination)",
            `İki benzer makarna tarifi başarıyla ayrıştırıldı (111 !== 115)`
        );

    } catch (err) {
        tracker.record(false, "Chunk Ayrım Testi", `Hata: ${err.message}`);
    }

    return tracker.summarize();
}

if (require.main === module) {
    runStandalone(testChunkDiscrimination);
}

module.exports = testChunkDiscrimination;
