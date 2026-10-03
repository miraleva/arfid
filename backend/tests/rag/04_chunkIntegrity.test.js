/**
 * 4. Chunk Bütünlük Testleri (Statik Kontrol)
 * chunking.py tarafından üretilen chunk listesini denetler:
 * - Hiçbir chunk boş/whitespace-only olmamalı
 * - Karakter sınırı (~500 karakter) aşılmamalı
 * - Her chunk geçerli bir page_number değerine sahip olmalı
 */

const path = require("path");
const { execSync } = require("child_process"); //node.js in terminalde komut çalıştırma modülü 
const { createCategoryTracker, runStandalone } = require("./_shared");

async function testChunkIntegrity() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 4. Chunk Bütünlük Testleri (Statik Veri Doğrulama)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("4. Chunk Bütünlük Kontrolleri");

    try { //json importla, pydeki parçalama dosyasını çağırır,chunkları 500 harflik parçalara böler 
        const pythonCode = "import json; from rag.chunking import load_and_chunk_all_markdowns; chunks = load_and_chunk_all_markdowns(500, 50); print(json.dumps({'total': len(chunks), 'empty_count': sum(1 for c in chunks if not c.get('text', '').strip()), 'no_page_count': sum(1 for c in chunks if c.get('page_number') is None), 'max_length': max(len(c.get('text', '')) for c in chunks), 'over_limit_count': sum(1 for c in chunks if len(c.get('text', '')) > 500)}))";

        const output = execSync(`python -c "${pythonCode}"`, { //execsync yani python tırnak içindeki kodu çalıştır diyo node.js 
            cwd: path.join(__dirname, "../.."),  //pynin hangi klasörde çalışacağını ayarlıyor backend klasörü
            encoding: "utf-8", //türkçeyle alakalı
            timeout: 15000 // 15 sn limit çünkü sonsuz zdöngüye girebilir 
        });

        const stats = JSON.parse(output.trim()); //pynin ekrana bastığı metin 

        // 1. Chunk üretimi kontrolü
        tracker.record(
            stats.total > 0,   //üretilen parça sayısı 0'dan büyük mü
            `Toplam Üretilen Chunk Sayısı`,
            `${stats.total} chunk tarandı`
        );

        // 2. Boş / whitespace chunk kontrolü
        tracker.record(
            stats.empty_count === 0, //boş chunk sayısı 0 mı 
            `Boş / Whitespace-only Chunk Kontrolü`,
            `Boş chunk sayısı: ${stats.empty_count}`
        );

        // 3. Sayfa numarası bütünlüğü
        tracker.record(
            stats.no_page_count === 0, //eksik sayfa sayısı 0 mı 
            `Sayfa Numarası (page_number) Bütünlüğü`,
            `Eksik sayfa sayılı chunk: ${stats.no_page_count}`
        );

        // 4. Karakter boyutu sınırı (500 limit kontrolü)
        tracker.record(
            stats.over_limit_count === 0,
            `Chunk Boyut Sınırı Kontrolü (Max 500 Karakter)`,
            `En uzun chunk: ${stats.max_length} karakter, 500'ü aşan: ${stats.over_limit_count}`
        );

    } catch (err) { // hata yakalar kod çökmesin diye
        tracker.record(false, "Chunk Bütünlük Statik Kontrolü", `Hata: ${err.message}`);
    }

    return tracker.summarize();
}

if (require.main === module) {
    runStandalone(testChunkIntegrity);
}

module.exports = testChunkIntegrity;
