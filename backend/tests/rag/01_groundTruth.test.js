/**
 * 1. Ground Truth Retrieval Testi
 * Deceptively Delicious kitabından gerçek cümleler/pasajlar sorgulanarak beklenen chunk/sayfanın
 * top-4 içinde doğru sırayla geldiği doğrulanır.
 */

const { RAG_SERVICE_URL, createCategoryTracker, runStandalone } = require("./_shared");

async function testGroundTruthRetrieval() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 1. Ground Truth Retrieval Testi (Kitaptan Gerçek Pasajlar)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("1. Ground Truth Retrieval");

    const testCases = [
        {
            name: "Sweet Potato Pancakes",
            query: "Sweet potato puree both sweetens and boosts the nutrition of this simple quick breakfast",
            expectedPage: 60,
            expectedSource: "deceptively_delicious.md"
        },
        {
            name: "Blueberry Lemon Muffins",
            query: "Using an ice cream scoop to fill the muffin cups makes it easy lowfat lemon yogurt",
            expectedPage: 72,
            expectedSource: "deceptively_delicious.md"
        },
        {
            name: "Brownies with Carrot & Spinach",
            query: "These brownies fool everyone spinach flavor totally disappears",
            expectedPage: 165,
            expectedSource: "deceptively_delicious.md"
        },
        {
            name: "Carrot Cake Muffins with Cauliflower",
            query: "My friends are always begging me to make these carrot cake muffins with cauliflower",
            expectedPage: 193,
            expectedSource: "deceptively_delicious.md"
        },
        {
            name: "Macaroni and Cheese 1",
            query: "I leave a box of store-bought macaroni and cheese out on the counter butternut squash",
            expectedPage: 111,
            expectedSource: "deceptively_delicious.md"
        }
    ];

    for (const tc of testCases) {
        try {
            const res = await fetch(`${RAG_SERVICE_URL}/retrieve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: tc.query, top_k: 4 })
            });

            if (!res.ok) {
                tracker.record(false, tc.name, `HTTP ${res.status}`);
                continue;
            }

            const data = await res.json();
            const chunks = data.chunks || [];
            const matchIndex = chunks.findIndex(
                c => c.page_number === tc.expectedPage && c.source.includes(tc.expectedSource)
            );

            const isFound = matchIndex !== -1;
            const rank = isFound ? matchIndex + 1 : null;
            const score = isFound ? chunks[matchIndex].score.toFixed(4) : "N/A";

            tracker.record(
                isFound,
                `${tc.name} [Hedef Sayfa: ${tc.expectedPage}]`,
                isFound ? `Sıra: ${rank}. chunk (top-4 içinde), Benzerlik Skoru: ${score}` : "Bulunamadı"
            );
        } catch (err) {
            tracker.record(false, tc.name, `Hata: ${err.message}`);
        }
    }

    return tracker.summarize();
}

if (require.main === module) {
    runStandalone(testGroundTruthRetrieval);
}

module.exports = testGroundTruthRetrieval;
