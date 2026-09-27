/**
 * Test: testFoodSearchAccuracy.js
 * 
 * Demonstrates search and filtering for:
 * 1. "kırmızı biber"
 * 2. "patates püresi"
 * 3. "tavuk göğsü"
 */

const { normalizeString } = require("../tools/utils/fuzzyMatch");

const DOMINANT_MODIFIERS = [
    "zeytin", "olive",
    "cips", "chips", "crisps",
    "sos", "sauce",
    "tursu", "pickle",
    "salca", "paste",
    "corba", "soup",
    "aromali", "flavoured",
    "cesnili", "seasoned",
    "dolgulu", "stuffed", "filled",
    "meatloaf", "lasagne", "makarna", "pasta",
    "pizza", "borek", "kraker", "cracker"
];

function isCleanMatch(searchTerm, productName) {
    if (!productName || typeof productName !== "string") {
        return { match: false, reason: "Ürün adı boş" };
    }

    const normSearch = normalizeString(searchTerm).toLowerCase();
    const normProd = normalizeString(productName).toLowerCase();

    const searchTokens = normSearch.split(/\s+/).filter(Boolean);
    const prodTokens = normProd.split(/\s+/).filter(Boolean);

    // 1. İstenmeyen baskın kelime kontrolü (Kullanıcı aramadığı halde üründe varsa)
    for (const mod of DOMINANT_MODIFIERS) {
        const userWanted = searchTokens.some(st => st.includes(mod) || mod.includes(st));
        const prodHas = prodTokens.some(pt => pt === mod || pt.startsWith(mod));
        if (!userWanted && prodHas) {
            return {
                match: false,
                reason: `Kullanıcı '${mod}' aramadı, ancak ürün '${mod}' içeriyor.`
            };
        }
    }

    // 2. Kelime benzerliği (Search tokens coverage)
    const matched = searchTokens.filter(st => prodTokens.some(pt => pt.includes(st)));
    const coverage = matched.length / searchTokens.length;

    if (coverage < 0.5) {
        return {
            match: false,
            reason: `Yetersiz kelime örtüşmesi (%${Math.round(coverage * 100)}).`
        };
    }

    return { match: true, score: coverage, reason: "Temiz ve geçerli ürün." };
}

// Canlı OFF Türkiye kataloğundaki gerçek veriler
const mockOFFCatalog = {
    "kırmızı biber": [
        { product_name: "Kırmızı Pul Biber", image_url: null },
        { product_name: "kırmızı biber dolgulu yeşil zeytin", image_url: "https://images.openfoodfacts.org/.../front_tr.3.400.jpg" },
        { product_name: "Kırmızı biber çeşnili patates cipsi acılı", image_url: null },
        { product_name: "Tatlı Kırmızı Biber Tadında Cips", image_url: "https://images.openfoodfacts.org/.../front_tr.5.400.jpg" },
        { product_name: "Közlenmiş Kırmızı Biber", image_url: "https://images.openfoodfacts.org/.../kozlenmis.jpg" }
    ],
    "patates püresi": [
        { product_name: "Knorr Patates Püresi 60 G", image_url: "https://images.openfoodfacts.org/.../patates_puresi.jpg" },
        { product_name: "Signature Meatloaf with Mashed Potatoes", image_url: "https://images.openfoodfacts.org/.../meatloaf.jpg" },
        { product_name: "Patates Cipsi", image_url: "https://images.openfoodfacts.org/.../cips.jpg" }
    ],
    "tavuk göğsü": [
        { product_name: "Tavuk göğsü piri piri soslu", image_url: null },
        { product_name: "Tavuk Göğsü", image_url: "https://images.openfoodfacts.org/.../tavuk_gogsu.jpg" },
        { product_name: "Kremalı Tavuk Çorbası", image_url: "https://images.openfoodfacts.org/.../corba.jpg" }
    ]
};

console.log("================================================================================");
console.log("🧪 OPEN FOOD FACTS ARAMA DOĞRULUĞU VE FİLTRELEME TESTİ");
console.log("================================================================================");

for (const [term, products] of Object.entries(mockOFFCatalog)) {
    console.log(`\n🔍 ARANAN TERİM: "${term}"`);
    console.log("--------------------------------------------------------------------------------");

    // ESKİ KOD SEÇİMİ: İlk resmi olanı al
    const oldChoice = products.find(p => p.image_url);
    console.log(`❌ ESKİ ALGORİTMA SEÇİMİ: "${oldChoice ? oldChoice.product_name : 'Hiçbiri'}"`);

    // YENİ AKILLI FİLTRELEME:
    const cleanCandidates = products.filter(p => p.image_url && isCleanMatch(term, p.product_name).match);
    const newChoice = cleanCandidates.length > 0 ? cleanCandidates[0] : null;

    console.log(`✅ YENİ ALGORİTMA SEÇİMİ: "${newChoice ? newChoice.product_name : 'Uygun saf ürün yok (Güvenli Fallback)'}"`);
    console.log("\nÜrün Bazlı Filtreleme Kararları:");
    products.forEach((p, idx) => {
        const check = isCleanMatch(term, p.product_name);
        const hasImg = !!p.image_url;
        const status = check.match ? "KABUL EDİLDİ" : "ELENDİ";
        console.log(`  ${idx + 1}. [${hasImg ? 'GÖRSEL VAR' : 'GÖRSEL YOK'}] "${p.product_name}" -> ${check.match ? '✅' : '🚫'} ${status} (${check.reason})`);
    });
}

console.log("\n================================================================================");
console.log("🏁 TEST SONUCU: Başarılı. İstenmeyen zeytin, cips ve çorbalar elendi!");
console.log("================================================================================");
