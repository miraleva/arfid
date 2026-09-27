/**
 * Test Script: offSearchAccuracy.test.js
 * 
 * Tests search accuracy and filtering algorithms for:
 * 1. "kırmızı biber"
 * 2. "patates püresi"
 * 3. "tavuk göğsü"
 * 
 * Evaluates:
 * - Direct TR Open Food Facts response vs. Filtered Match
 * - English translation fallback
 * - Extra modifier / intruder word elimination
 */

const { normalizeString } = require("../tools/utils/fuzzyMatch");

// Common Turkish to English mapping for single ingredients
const TR_EN_FOOD_MAP = {
    "kirmizi biber": "red bell pepper",
    "biber": "bell pepper",
    "patates puresi": "mashed potatoes",
    "patates": "potato",
    "tavuk gogsu": "chicken breast",
    "tavuk": "chicken"
};

// Dominant food modifier keywords that change the nature of the product if not requested
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
    "lasagne", "makarna", "pasta",
    "pizza",
    "borek",
    "kraker", "cracker"
];

/**
 * Determines whether a product is a clean match for the search term.
 * Checks for token coverage and filters out intruder dominant modifier words.
 */
function isCleanMatch(searchTerm, productName) {
    if (!productName || typeof productName !== "string") return false;

    const normSearch = normalizeString(searchTerm).toLowerCase();
    const normProd = normalizeString(productName).toLowerCase();

    const searchTokens = normSearch.split(/\s+/).filter(Boolean);
    const prodTokens = normProd.split(/\s+/).filter(Boolean);

    // 1. Check intruder words: Did the product introduce a dominant modifier that wasn't requested?
    for (const mod of DOMINANT_MODIFIERS) {
        const userRequestedMod = searchTokens.some(st => st.includes(mod) || mod.includes(st));
        const productHasMod = prodTokens.some(pt => pt === mod || pt.startsWith(mod));

        if (!userRequestedMod && productHasMod) {
            return {
                match: false,
                reason: `Eşleşmedi: Kullanıcı '${mod}' istemedi ancak ürün '${mod}' içeriyor.`
            };
        }
    }

    // 2. Token overlap: Check how many search tokens are present
    const matchedTokens = searchTokens.filter(st => prodTokens.some(pt => pt.includes(st)));
    const coverage = matchedTokens.length / searchTokens.length;

    if (coverage < 0.6) {
        return {
            match: false,
            reason: `Eşleşmedi: Kelime örtüşmesi yetersiz (%${Math.round(coverage * 100)}).`
        };
    }

    return {
        match: true,
        score: coverage,
        reason: "Temiz ve geçerli eşleşme."
    };
}

async function fetchFromOFF(term, domain = "tr.openfoodfacts.org") {
    const encoded = encodeURIComponent(term.trim());
    const url = `https://${domain}/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,image_front_url,image_url,url,code,nutriments`;

    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "ArfidTest/1.0 (contact@arfid.org)" }
        });
        if (!res.ok) return { ok: false, status: res.status, products: [] };
        const data = await res.json();
        return { ok: true, products: Array.isArray(data.products) ? data.products : [] };
    } catch (err) {
        return { ok: false, error: err.message, products: [] };
    }
}

async function runTestCase(rawTerm) {
    console.log(`\n======================================================`);
    console.log(`🔍 TEST EDİLEN BESİN: "${rawTerm}"`);
    console.log(`======================================================`);

    // 1. Standart TR Araması (Mevcut koddaki gibi)
    const trRes = await fetchFromOFF(rawTerm, "tr.openfoodfacts.org");
    console.log(`\n[1. Adım - Standart TR Arama Sonuçları (${trRes.products.length} ürün)]:`);
    
    let oldChoice = null;
    trRes.products.forEach((p, idx) => {
        const hasImg = !!(p.image_front_url || p.image_url);
        const name = p.product_name || "İsimsiz";
        const filterCheck = isCleanMatch(rawTerm, name);
        const marker = filterCheck.match ? "✅ [UYGUN]" : "❌ [ELENDİ]";
        
        if (!oldChoice && hasImg) {
            oldChoice = { name, img: p.image_front_url || p.image_url };
        }

        console.log(`   ${idx + 1}. [${hasImg ? 'GÖRSEL VAR' : 'GÖRSEL YOK'}] "${name}" -> ${marker} (${filterCheck.reason})`);
    });

    console.log(`\n   ⚠️  Eski kodun seçeceği ürün: "${oldChoice ? oldChoice.name : 'Hiçbiri'}" (Görsel: ${oldChoice ? oldChoice.img : 'Yok'})`);

    // 2. Akıllı Filtreleme Sonucu (TR İçinde)
    const cleanTRMatch = trRes.products.find(p => {
        const hasImg = !!(p.image_front_url || p.image_url);
        return hasImg && isCleanMatch(rawTerm, p.product_name || "").match;
    });

    if (cleanTRMatch) {
        console.log(`\n   🎯 Akıllı Filtreleme ile Seçilen (TR): "${cleanTRMatch.product_name}"`);
        console.log(`      Görsel: ${cleanTRMatch.image_front_url || cleanTRMatch.image_url}`);
    } else {
        console.log(`\n   ℹ️  TR Kataloğunda temiz görsel eşleşmesi bulunamadı. İngilizce arama deneniyor...`);
        
        // 3. İngilizce Terim ile Arama (World / Fallback)
        const normKey = normalizeString(rawTerm).toLowerCase();
        const enTerm = TR_EN_FOOD_MAP[normKey] || rawTerm;
        console.log(`   🌐 İngilizce Terim: "${enTerm}" (world.openfoodfacts.org)`);

        const worldRes = await fetchFromOFF(enTerm, "world.openfoodfacts.org");
        const cleanWorldMatch = worldRes.products.find(p => {
            const hasImg = !!(p.image_front_url || p.image_url);
            return hasImg && isCleanMatch(enTerm, p.product_name || "").match;
        });

        if (cleanWorldMatch) {
            console.log(`   🎯 İngilizce Arama ile Seçilen: "${cleanWorldMatch.product_name}"`);
            console.log(`      Görsel: ${cleanWorldMatch.image_front_url || cleanWorldMatch.image_url}`);
        } else {
            console.log(`   ❌ Temiz ürün bulunamadı, güvenli placeholder kullanılacak.`);
        }
    }
}

async function main() {
    console.log("🚀 Open Food Facts Arama Doğruluğu Testi Başlatılıyor...\n");
    await runTestCase("kırmızı biber");
    await runTestCase("patates püresi");
    await runTestCase("tavuk göğsü");
    console.log("\n======================================================");
    console.log("🏁 Test Tamamlandı.");
}

main();
