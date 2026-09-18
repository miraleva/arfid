/**
 * 2. Paraphrase (Yeniden İfade) Dayanıklılık Testi
 * Kelime sırası değiştirilmiş, eş anlamlılar kullanılmış veya İngilizce-Türkçe çeviri simülasyonu
 * uygulanmış sorgularda semantik aramanın doğru chunk'ı getirdiği doğrulanır.
 */

const { RAG_SERVICE_URL, createCategoryTracker, runStandalone } = require("./_shared");

async function testParaphraseResilience() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 2. Paraphrase (Yeniden İfade) Dayanıklılık Testi (Semantic Similarity Kanıtı)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("2. Paraphrase Dayanıklılık");

    const paraphraseCases = [
        {
            originalName: "Brownies (Sayfa 165)",
            expectedPage: 165,
            expectedSource: "deceptively_delicious.md",
            paraphrasedQuery: "These fudge brownies trick everyone, hard to believe how moist and delicious they taste containing disguised pureed spinach and carrots.",
            technique: "Anlamsal yeniden ifade + eşanlamlı kelimeler (trick/disguised/moist)"
        },
        {
            originalName: "Macaroni and Cheese (Sayfa 111)",
            expectedPage: 111,
            expectedSource: "deceptively_delicious.md",
            paraphrasedQuery: "Sneaking pureed butternut squash or cauliflower into prepared boxed macaroni noodles and cheese sauce",
            technique: "Kelime sırası ve eylem dönüşümü (sneaking puree into boxed macaroni)"
        }
    ];

    for (const pc of paraphraseCases) {
        try {
            const res = await fetch(`${RAG_SERVICE_URL}/retrieve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: pc.paraphrasedQuery, top_k: 4 })
            });

            const data = await res.json();
            const chunks = data.chunks || [];
            const matchIndex = chunks.findIndex(
                c => c.page_number === pc.expectedPage && c.source.includes(pc.expectedSource)
            );

            const isFound = matchIndex !== -1;
            const rank = isFound ? matchIndex + 1 : null;
            const score = isFound ? chunks[matchIndex].score.toFixed(4) : "N/A";

            tracker.record(
                isFound,
                `Paraphrase: ${pc.originalName}`,
                isFound 
                    ? `Sıra: ${rank}. chunk, Skor: ${score} | Kanıt: Kelime eşleşmesi değil, Vektörel Semantik Benzerlik çalıştı [${pc.technique}]`
                    : "Top-4 içinde bulunamadı"
            );
        } catch (err) {
            tracker.record(false, `Paraphrase: ${pc.originalName}`, `Hata: ${err.message}`);
        }
    }

    return tracker.summarize();
}

if (require.main === module) {
    runStandalone(testParaphraseResilience);
}

module.exports = testParaphraseResilience;
