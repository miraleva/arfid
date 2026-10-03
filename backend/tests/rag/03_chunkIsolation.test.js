/**
 * 3. Chunk Karıştırma / Ayrım Testi (Discrimination & Isolation)
 * Birbirine yakın konudaki 2 farklı tarifin (örn. Macaroni 1 vs Macaroni 2)
 * ayırt edici detaylar üzerinden birbirine karışmadan kendi doğru chunk'larını getirdiği doğrulanır.
 */
//yine required url ve fonklar shared.jsten
const { RAG_SERVICE_URL, createCategoryTracker, runStandalone } = require("./_shared");
//bu fonk modele sorgu atıp cevap alcak inş, parça ayrıştırma testi 
async function testChunkDiscrimination() { //termianlde çıkan log texti
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 3. Chunk Karıştırma / Ayrım Testi (Komşu Tarif İzolasyonu)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("3. Chunk Karıştırma / Ayrım"); //testlerin durumunu trackliyor

    // Sayfa 111: Macaroni and Cheese 1 (Butternut Squash / Cauliflower)
    // Sayfa 115: Macaroni and Cheese 2 (White beans / Chickpeas / Navy beans)
    const queryA = "Macaroni and cheese recipe incorporating yellow butternut squash or cauliflower puree";
    const queryB = "Macaroni and cheese recipe with canned white beans, navy beans or chickpeas for extra protein";

    try { //test kodları, aşağıdaki işlemleri yapmayı trylıyor
        const [resA, resB] = await Promise.all([ //iki sorguyu aynı anda gönderiyor cvplar soldakilere atanacak sonuçlar tek seferde gelecek
            fetch(`${RAG_SERVICE_URL}/retrieve`, {
                method: "POST", //http istek metodu
                headers: { "Content-Type": "application/json" }, //ne gönderdiğini söylüyor json olarak
                body: JSON.stringify({ query: queryA, top_k: 4 })
            }).then(r => r.json()), //sunucudan gelen cevabı jsona çeviriyor 
            fetch(`${RAG_SERVICE_URL}/retrieve`, { //fetch isteği atıyor
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryB, top_k: 4 }) //yine sorgu gönderiliyor
            }).then(r => r.json()) //bu cvpları jsona çeviriyor
        ]);

        const topPageA = resA.chunks?.[0]?.page_number; //chunk numarasını alıyor
        const topPageB = resB.chunks?.[0]?.page_number;

        // Query A must prioritize Page 111 
        const passA = topPageA === 111; //A'nın chunk nosunun 111 olup olmadığını kontrol ediyor true or false
        tracker.record(
            passA, //1. parametre  true or false 
            "Sorgu A: Butternut Squash Macaroni -> Sayfa 111'e yönlendi", //test başlığı
            `Top-1 Sayfa: ${topPageA} (Beklenen: 111)`
        );

        // Query B must prioritize Page 115
        const passB = topPageB === 115; //B chunk no 115 mi 
        tracker.record(
            passB,
            "Sorgu B: Beans/Chickpeas Macaroni -> Sayfa 115'e yönlendi",
            `Top-1 Sayfa: ${topPageB} (Beklenen: 115)`
        );

        // Discrimination check: They should not map to the same top recipe
        const noCrossContamination = topPageA !== topPageB && passA && passB; //şair diyor ki ikisinin chunk nosu farklı olmalı ve 3 şart doğru olmalı 
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

if (require.main === module) { //dosya terminalden tek bşaına mı çalıştırıldı öyleyse testi hemen çalıştırıp sonuçları ekrana bas
    runStandalone(testChunkDiscrimination);
}

module.exports = testChunkDiscrimination;
