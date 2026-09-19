/**
 * 2. Paraphrase (Yeniden İfade) Dayanıklılık Testi
 * Kelime sırası değiştirilmiş, eş anlamlılar kullanılmış veya İngilizce-Türkçe çeviri simülasyonu
 * uygulanmış sorgularda semantik aramanın doğru chunk'ı getirdiği doğrulanır.
 */
//const yani değeri değiştirilmeyen sabit değişken bide let var o da esnek olan 

// süslü parantez içindekileri çağırıyor shared dosyasından
const { RAG_SERVICE_URL, createCategoryTracker, runStandalone } = require("./_shared");
//fonk belirtiliyo, asyncte bu fonkun içine istek atılcak sunucu await yapabilir 
async function testParaphraseResilience() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 2. Paraphrase (Yeniden İfade) Dayanıklılık Testi (Semantic Similarity Kanıtı)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("2. Paraphrase Dayanıklılık"); //tracker üstteki createcategorytracker fonkunu çağrıyo 
    const paraphraseCases = [  //test senaryolaro listesi tanımladığımız değişkene atıyozz, köşeli array süslü object
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
                method: "POST",  //sunucuya data göndermek için kullanılan istek 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: pc.paraphrasedQuery, top_k: 4 })
            });

            const data = await res.json();
            const chunks = data.chunks || [];
            const matchIndex = chunks.findIndex(
                c => c.page_number === pc.expectedPage && c.source.includes(pc.expectedSource)
            );
            //condition (test edilen ya true ya false dönecek) ? value if true: value if false 
            const isFound = matchIndex !== -1; //isfound bulunup bulunmadığını kontrol ediyo -1 değilse bulundu diyo
            const rank = isFound ? matchIndex + 1 : null; //rank bulunduğunda sırasını yazdırıyor birde +1 çünkü 0dan saymaya başlıyo 
            const score = isFound ? chunks[matchIndex].score.toFixed(4) : "N/A"; //score bulunan chunkun skorunu yazıyor 4 haneli 

            tracker.record( //tracker test sonucunu kaydediyor eğer yukarıda isfound true döndüyse
                isFound, //boolean 
                `Paraphrase: ${pc.originalName}`, //test başlığı
                isFound //true dönerse
                    ? `Sıra: ${rank}. chunk, Skor: ${score} | Kanıt: Kelime eşleşmesi değil, Vektörel Semantik Benzerlik çalıştı [${pc.technique}]`
                    : "Top-4 içinde bulunamadı"//false dönerse 
            );
        } catch (err) { //hata çıkarsa o hatayı err kutusuna alıp catch bloğuna geçer hata der
            tracker.record(false, `Paraphrase: ${pc.originalName}`, `Hata: ${err.message}`);
        }
    }

    return tracker.summarize(); //fonk işi bitince özetini döndürüyor tüm sonuçların 
}

if (require.main === module) { //bu dosya terminalden doğrudan mı çalıştırıldı yoksa başka bi dosya requierladı mı kontrol eder
    runStandalone(testParaphraseResilience); //terminalden çalıştırıldıysa testi hemen başlatır
}

module.exports = testParaphraseResilience; //standartt 
