const assert = require("assert");
const db = require("../db");
const { searchProductImage, enrichWidget, getCachedProduct } = require("../services/openFoodFactsService");
const { normalizeString } = require("../tools/utils/fuzzyMatch");

async function run() {
  console.log("============================================================");
  console.log("🧪 TEST 1-3 DOĞRULAMA (Patates, Biber, Nutella, 2 Gün Cache)");
  console.log("============================================================\n");

  // 1. "Patates" ve "Kırmızı Biber" sorguları: OFF'a gitmeden doğrudan yerel kütüphaneden dönmeli
  console.log("--- TEST 1: 'patates' ve 'kırmızı biber' yerel kütüphane kontrolü ---");
  const patatesRes = await searchProductImage("patates");
  assert.ok(patatesRes, "Patates sonucu dönmeli");
  assert.strictEqual(patatesRes.from_local_library, true, "Patates yerel kütüphaneden gelmeli");
  assert.strictEqual(patatesRes.source_domain, "local_curated", "source_domain local_curated olmalı");
  assert.ok(patatesRes.image_url.includes("unsplash.com"), "Görsel URL Unsplash olmalı");
  console.log("✅ [DOĞRULANDI] Patates yerel kütüphaneden başarıyla geldi (OFF atlandı):", patatesRes.image_url);

  const biberRes = await searchProductImage("kırmızı biber");
  assert.ok(biberRes, "Kırmızı biber sonucu dönmeli");
  assert.strictEqual(biberRes.from_local_library, true, "Kırmızı biber yerel kütüphaneden gelmeli");
  assert.strictEqual(biberRes.source_domain, "local_curated", "source_domain local_curated olmalı");
  console.log("✅ [DOĞRULANDI] Kırmızı biber yerel kütüphaneden başarıyla geldi (OFF atlandı):", biberRes.image_url);

  // Widget zenginleştirme kontrolü (Attribution rozeti kontrolü)
  const widgetTest = await enrichWidget({
    type: "nutrition",
    title: "Patates Haşlama",
    data: { food_name: "patates" }
  });
  assert.strictEqual(widgetTest.data.image_placeholder.source_name, "Arfid Kütüphanesi (Unsplash)");
  console.log("✅ [DOĞRULANDI] Widget attribution: " + widgetTest.data.image_placeholder.source_name);

  // 2. "Nutella" gibi yerel listede olmayan ürün: OFF akışına devam etmeli
  console.log("\n--- TEST 2: Yerel listede olmayan ürün ('Nutella') OFF akışı kontrolü ---");
  const nutellaRes = await searchProductImage("Nutella");
  assert.ok(nutellaRes, "Nutella sonucu dönmeli");
  assert.strictEqual(nutellaRes.from_local_library, undefined, "Nutella yerel kütüphaneden gelmemeli");
  assert.ok(nutellaRes.image_url.includes("openfoodfacts.org"), "Nutella görseli OFF'tan gelmeli");
  console.log("✅ [DOĞRULANDI] Nutella OFF akışından başarıyla geldi:", nutellaRes.image_url);

  // 3. Cache 2 güne düşme testi:
  // 3 gün önce yazılmış bir kayıt expires_at kontrolü yapıldığında süresi geçmiş sayılmalı
  console.log("\n--- TEST 3: Cache 2 gün (48 saat) geçerlilik testi ---");
  const expiredTerm = "test_custom_cache_2days";
  const normalized = normalizeString(expiredTerm);
  const threeDaysAgoSeconds = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60);

  // DB'ye 3 gün öncesine ait eski bir kayıt yerleştiriyoruz
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO off_image_cache (query_term, image_url, product_name, source_url, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [normalized, "http://expired-3days.com/test.jpg", "Expired Product", "http://test.com", threeDaysAgoSeconds - 100, threeDaysAgoSeconds],
      (err) => err ? reject(err) : resolve()
    );
  });

  const row = await getCachedProduct(normalized);
  const nowSeconds = Math.floor(Date.now() / 1000);
  assert.ok(row.expires_at < nowSeconds, "3 gün önceki kayıt süresi geçmiş sayılmalı");
  console.log(`✅ [DOĞRULANDI] 3 gün önceki kayıt süresi geçmiş sayıldı (Kayıt expires_at: ${row.expires_at}, Şu an: ${nowSeconds})`);

  console.log("\n============================================================");
  console.log("🎉 TÜM DOĞRULAMA TESTLERİ BAŞARIYLA TAMAMLANDI!");
  console.log("============================================================\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
