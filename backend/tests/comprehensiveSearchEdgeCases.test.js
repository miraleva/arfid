/**
 * Test Suite: comprehensiveSearchEdgeCases.test.js
 * 
 * Tests 15 distinct edge cases for food search filtering algorithm:
 * 
 * 1. User wants pure food, product is processed snack/crisp (elma -> elmalı bisküvi)
 * 2. User actually wants the snack (elmalı bisküvi -> elmalı bisküvi)
 * 3. User wants beverage, product is confectionery (portakal suyu -> portakal aromalı sakız)
 * 4. User wants dairy/cheese, product is pizza/pasta topping (kaşar peyniri -> kaşarlı dondurulmuş pizza)
 * 5. User wants simple condiment, product is heavy dip (domates -> domatesli makarna sosu)
 * 6. User wants meat, product is broth/bouillon (dana eti -> dana etli bulyon)
 * 7. User wants plain starch, product is lasagna/ready meal (patates -> patatesli hazır lazanya)
 * 8. User wants pickle specifically (salatalık turşusu -> kornişon salatalık turşusu vs sade salatalık)
 * 9. User wants coffee, product is chocolate/creamer (kahve -> kahveli çikolata)
 * 10. User wants fruit, product is scented candle/tea (çilek -> çilek aromalı bitki çayı)
 * 11. User wants egg, product is egg pasta (yumurta -> yumurtalı erişte)
 * 12. Typo & Word Order variation (biber kırmızı -> Kırmızı Biber)
 * 13. Multi-word exact dish (fırında makarna -> Fırında Makarna)
 * 14. Olive oil vs canned fish in olive oil (zeytinyağı -> zeytinyağlı ton balığı)
 * 15. User wants plain yoghurt, product is fruit/sugar yogurt dessert (yoğurt -> çilekli meyveli yoğurt tatlısı)
 */

const { normalizeString } = require("../tools/utils/fuzzyMatch");

const DOMINANT_MODIFIERS = [
    // Snacks & Sweets
    "bisküvi", "biskuvi", "biscuit", "cookie", "kurabiye",
    "cips", "chips", "crisps", "kraker", "cracker",
    "çikolata", "cikolata", "chocolate", "gofret", "wafer", "şeker", "seker", "candy", "sakız", "sakiz", "gum",
    // Sauces & Condiments
    "sos", "sauce", "salça", "salca", "paste", "ketçap", "ketcap", "mayonez",
    // Soups, Broths & Bouillons
    "çorba", "corba", "soup", "bulyon", "bouillon", "harç", "harc", "seasoning",
    // Prepared / Ready Meals & Fast Food
    "pizza", "lazanya", "lasagne", "makarna", "pasta", "erişte", "eriste", "noodle",
    "börek", "borek", "pide", "meatloaf",
    // Preserved / Pickled
    "zeytin", "olive", "turşu", "tursu", "pickle",
    // Canned proteins in base ingredients
    "ton balığı", "ton baligi", "tuna",
    // Descriptors changing pure state
    "aromalı", "aromali", "flavoured", "çeşnili", "cesnili", "seasoned",
    "dolgulu", "stuffed", "filled", "kaplamalı", "kaplamali"
];

function isCleanMatch(searchTerm, productName) {
    if (!productName || typeof productName !== "string") {
        return { match: false, reason: "Ürün adı boş" };
    }

    const normSearch = normalizeString(searchTerm).toLowerCase();
    const normProd = normalizeString(productName).toLowerCase();

    const searchTokens = normSearch.split(/\s+/).filter(Boolean);
    const prodTokens = normProd.split(/\s+/).filter(Boolean);

    // 1. Intruder modifier check: Did product introduce a dominant modifier NOT requested?
    for (const mod of DOMINANT_MODIFIERS) {
        const normMod = normalizeString(mod).toLowerCase();
        const userWanted = searchTokens.some(st => st.includes(normMod) || normMod.includes(st));
        const prodHas = normProd.includes(normMod);

        if (!userWanted && prodHas) {
            return {
                match: false,
                reason: `Kullanıcı '${mod}' aramadı, ancak ürün '${mod}' içeriyor.`
            };
        }
    }

    // Helper to check token match with Turkish consonant alternation (k->g/ğ, t->d) and suffix tolerance
    function tokenMatches(searchToken, prodToken) {
        if (searchToken === prodToken || searchToken.includes(prodToken) || prodToken.includes(searchToken)) {
            return true;
        }
        // Stem comparison for Turkish mutations (çilek/çileği, yoğurt/yoğurdu)
        const stemA = searchToken.replace(/[kğtd]$/, "").slice(0, 4);
        const stemB = prodToken.replace(/[kğtd]$/, "").slice(0, 4);
        return stemA.length >= 3 && stemA === stemB;
    }

    // 2. Token overlap: Ensure user's key words actually exist in the product
    const matched = searchTokens.filter(st => prodTokens.some(pt => tokenMatches(st, pt)));
    const coverage = matched.length / searchTokens.length;

    // Arama 2 kelimeliyse ("elmalı bisküvi", "salatalık turşusu") her ikisi de üründe bulunmalı (coverage >= 0.9)
    const requiredCoverage = searchTokens.length <= 2 ? 0.9 : 0.65;

    if (coverage < requiredCoverage) {
        return {
            match: false,
            reason: `Yetersiz kelime örtüşmesi (%${Math.round(coverage * 100)}, beklenen en az %${Math.round(requiredCoverage * 100)}).`
        };
    }

    return {
        match: true,
        score: coverage,
        reason: "Temiz ve geçerli eşleşme."
    };
}

// 15 Comprehensive Edge Cases
const testCases = [
    {
        id: 1,
        title: "Saf Meyve vs Meyveli Bisküvi",
        search: "elma",
        products: [
            { name: "Elmalı Tarçınlı Bisküvi", shouldPass: false },
            { name: "Amasya Taze Kırmızı Elma", shouldPass: true }
        ]
    },
    {
        id: 2,
        title: "Kullanıcı Bisküvi İstediğinde Bisküvi Engellenmemeli",
        search: "elmalı bisküvi",
        products: [
            { name: "Elmalı Tarçınlı Bisküvi", shouldPass: true },
            { name: "Taze Elma", shouldPass: false }
        ]
    },
    {
        id: 3,
        title: "İçecek vs Aromalı Sakız",
        search: "portakal suyu",
        products: [
            { name: "Portakal Aromalı Şekersiz Sakız", shouldPass: false },
            { name: "100% Sıkma Portakal Suyu", shouldPass: true }
        ]
    },
    {
        id: 4,
        title: "Sade Peynir vs Donmuş Pizza",
        search: "kaşar peyniri",
        products: [
            { name: "Kaşarlı ve Sucuklu Dondurulmuş Pizza", shouldPass: false },
            { name: "Tam Yağlı Taze Kaşar Peyniri", shouldPass: true }
        ]
    },
    {
        id: 5,
        title: "Sade Sebze vs Hazır Makarna Sosu",
        search: "domates",
        products: [
            { name: "Fesleğenli Domatesli Makarna Sosu", shouldPass: false },
            { name: "Salkım Domates", shouldPass: true }
        ]
    },
    {
        id: 6,
        title: "Et vs Bulyon",
        search: "dana eti",
        products: [
            { name: "Dana Etli Çorbalık Bulyon", shouldPass: false },
            { name: "Dana Kuşbaşı Et", shouldPass: true }
        ]
    },
    {
        id: 7,
        title: "Saf Patates vs Hazır Lazanya",
        search: "patates",
        products: [
            { name: "Patatesli Kıymalı Hazır Lazanya", shouldPass: false },
            { name: "Taze Patates", shouldPass: true }
        ]
    },
    {
        id: 8,
        title: "Kullanıcı Turşu İstediğinde Turşu Kabul Edilmeli",
        search: "salatalık turşusu",
        products: [
            { name: "Geleneksel Çubuk Salatalık Turşusu", shouldPass: true },
            { name: "Taze Çengelköy Salatalık", shouldPass: false }
        ]
    },
    {
        id: 9,
        title: "Kahve vs Kahveli Çikolata",
        search: "filtre kahve",
        products: [
            { name: "Filtre Kahve Aromalı Bitter Çikolata", shouldPass: false },
            { name: "Kavrulmuş Çekirdek Filtre Kahve", shouldPass: true }
        ]
    },
    {
        id: 10,
        title: "Taze Çilek vs Çilekli Çay",
        search: "çilek",
        products: [
            { name: "Çilek Aromalı Poşet Çay", shouldPass: false },
            { name: "Taze Tarla Çileği", shouldPass: true }
        ]
    },
    {
        id: 11,
        title: "Yumurta vs Erişte",
        search: "yumurta",
        products: [
            { name: "Köy Usulü Yumurtalı Erişte", shouldPass: false },
            { name: "Organik Gezen Tavuk Yumurtası", shouldPass: true }
        ]
    },
    {
        id: 12,
        title: "Kelime Sırası Değişikliği (biber kırmızı)",
        search: "biber kırmızı",
        products: [
            { name: "Kırmızı Biber", shouldPass: true },
            { name: "Kırmızı Biberli Patates Cipsi", shouldPass: false }
        ]
    },
    {
        id: 13,
        title: "Kullanıcı Makarna İstediğinde Makarna Kabul Edilmeli",
        search: "makarna",
        products: [
            { name: "Burgu Makarna", shouldPass: true },
            { name: "Makarna Sosu", shouldPass: false }
        ]
    },
    {
        id: 14,
        title: "Zeytinyağı vs Zeytinyağlı Ton Balığı",
        search: "zeytinyağı",
        products: [
            { name: "Zeytinyağlı Konserve Ton Balığı", shouldPass: false },
            { name: "Soğuk Sıkım Natürel Sızma Zeytinyağı", shouldPass: true }
        ]
    },
    {
        id: 15,
        title: "Sade Yoğurt vs Çilekli Şekerli Yoğurt Tatlısı",
        search: "sade yoğurt",
        products: [
            { name: "Çilekli Şekerli Yoğurt Tatlısı", shouldPass: false },
            { name: "Geleneksel Sade Tava Yoğurdu", shouldPass: true }
        ]
    }
];

console.log("================================================================================");
console.log("🧪 15 KRİTİK EDGE CASE İLE ARAMA VE FİLTRELEME TESTİ");
console.log("================================================================================");

let totalTests = 0;
let passedTests = 0;

testCases.forEach(tc => {
    console.log(`\nCase #${tc.id}: ${tc.title}`);
    console.log(`  Aranan: "${tc.search}"`);
    console.log("  ------------------------------------------------------------------------------");

    tc.products.forEach(p => {
        totalTests++;
        const result = isCleanMatch(tc.search, p.name);
        const passed = (result.match === p.shouldPass);
        if (passed) passedTests++;

        const icon = passed ? "✅" : "❌ HATA";
        const decision = result.match ? "KABUL" : "RED";
        console.log(`  ${icon} Ürün: "${p.name}" -> Karar: [${decision}] (Beklenen: ${p.shouldPass ? 'KABUL' : 'RED'})`);
        if (!result.match) {
            console.log(`     Sebep: ${result.reason}`);
        }
    });
});

console.log("\n================================================================================");
console.log(`🏁 TEST RAPORU: ${passedTests} / ${totalTests} test başarıyla tamamlandı (%${Math.round((passedTests/totalTests)*100)})`);
console.log("================================================================================");
