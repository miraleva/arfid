/**
 * Calorie Database for ARFID Assistant
 * Common ingredients, calorie and macronutrient values per 100g or per standard unit piece.
 * Includes Turkish and English alias support for robust semantic matching.
 */

const calorieDatabase = [
    // --- SÜT VE SÜT ÜRÜNLERİ ---
    // Varsayılan: Standart tam yağlı inek sütü (~%3.3 yağ) baz alınmıştır.
    {
        id: "sut",
        name: "tam yağlı süt",
        aliases: ["süt", "milk", "inek sütü", "tam yağlı süt", "cow milk", "whole milk"],
        caloriesPer100g: 61,
        defaultUnit: "ml",
        unitGrams: 1.03, // 1 ml ~ 1.03g
        servingUnit: "su bardağı",
        servingGrams: 200, // 1 su bardağı ~ 200ml / ~122 kcal
        note: "Varsayılan olarak standart tam yağlı inek sütü (%3.3 yağ) baz alınmıştır."
    },
    // Varsayılan: Standart tam yağlı yoğurt (~%3.5 yağ) baz alınmıştır.
    {
        id: "yogurt",
        name: "tam yağlı yoğurt",
        aliases: ["yoğurt", "yogurt", "tam yağlı yoğurt", "sade yoğurt", "plain yogurt"],
        caloriesPer100g: 61,
        defaultUnit: "gram",
        servingUnit: "kase",
        servingGrams: 200, // 1 orta kase ~ 200g
        note: "Varsayılan olarak geleneksel tam yağlı yoğurt baz alınmıştır."
    },
    // Varsayılan: Klasik tam yağlı beyaz peynir (~%45 kuru madde yağı) baz alınmıştır.
    {
        id: "beyaz_peynir",
        name: "tam yağlı beyaz peynir",
        aliases: ["beyaz peynir", "peynir", "feta", "cheese", "white cheese"],
        caloriesPer100g: 260,
        defaultUnit: "gram",
        servingUnit: "dilim",
        servingGrams: 30, // 1 kibrit kutusu / dilim ~ 30g
        note: "Varsayılan olarak standart tam yağlı beyaz peynir baz alınmıştır."
    },
    // Varsayılan: Standart tereyağı (%82 süt yağı) baz alınmıştır.
    {
        id: "tereyagi",
        name: "tereyağı",
        aliases: ["tereyağı", "tereyag", "butter"],
        caloriesPer100g: 717,
        defaultUnit: "gram",
        servingUnit: "yemek kaşığı",
        servingGrams: 14,
        note: "Varsayılan olarak geleneksel %82 yağlı tereyağı baz alınmıştır."
    },
    {
        id: "kasar_peyniri",
        name: "kaşar peyniri",
        aliases: ["kaşar", "kasar", "kaşar peyniri", "cheddar", "yellow cheese"],
        caloriesPer100g: 350,
        defaultUnit: "gram",
        servingUnit: "dilim",
        servingGrams: 25,
        note: "Varsayılan olarak taze tam yağlı kaşar peyniri baz alınmıştır."
    },

    // --- ETLER VE PROTEİNLER ---
    // Varsayılan: Çiğ, derisiz tavuk göğsü fileto baz alınmıştır.
    {
        id: "tavuk_gogsu",
        name: "tavuk göğsü",
        aliases: ["tavuk göğsü", "tavuk", "tavuk gogsu", "chicken breast", "chicken"],
        caloriesPer100g: 120,
        defaultUnit: "gram",
        servingUnit: "adet",
        servingGrams: 150, // 1 parça fileto ~ 150g
        note: "Varsayılan olarak derisiz, çiğ tavuk göğsü fileto baz alınmıştır."
    },
    // Varsayılan: Çiğ, orta yağlı dana kıyma (~%15-20 yağ) baz alınmıştır.
    {
        id: "dana_kiyma",
        name: "dana kıyma",
        aliases: ["kıyma", "dana kıyma", "kiyma", "ground beef", "minced meat"],
        caloriesPer100g: 215,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 100,
        note: "Varsayılan olarak orta yağlı dana kıyma baz alınmıştır."
    },
    // Varsayılan: Çiğ, yağsız dana biftek / kontrfile baz alınmıştır.
    {
        id: "biftek",
        name: "dana biftek",
        aliases: ["biftek", "dana eti", "steak", "beef", "dana biftek"],
        caloriesPer100g: 150,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 150,
        note: "Varsayılan olarak yağsız dana biftek baz alınmıştır."
    },
    // Varsayılan: Orta boy (M/L) bütün tavuk yumurtası (~50g) baz alınmıştır.
    {
        id: "yumurta",
        name: "yumurta",
        aliases: ["yumurta", "egg", "eggs", "haşlanmış yumurta"],
        caloriesPer100g: 143,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 50, // 1 adet yumurta ~ 72 kcal
        note: "Varsayılan olarak 1 adet orta boy (50g) bütün yumurta baz alınmıştır."
    },
    {
        id: "somon",
        name: "somon balığı",
        aliases: ["somon", "salmon", "somon balığı", "balık"],
        caloriesPer100g: 208,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 150,
        note: "Varsayılan olarak çiğ somon fileto baz alınmıştır."
    },
    {
        id: "ton_baligi",
        name: "ton balığı (konserve süzülmüş)",
        aliases: ["ton balığı", "tuna", "konserve ton balığı", "ton baligi"],
        caloriesPer100g: 130,
        defaultUnit: "gram",
        servingUnit: "kutu",
        servingGrams: 160,
        note: "Varsayılan olarak süzülmüş konserve ton balığı baz alınmıştır."
    },

    // --- TAHILLAR VE EKMEKLER ---
    // Varsayılan: Çiğ, sade yulaf ezmesi (rolled oats) baz alınmıştır.
    {
        id: "yulaf",
        name: "yulaf ezmesi",
        aliases: ["yulaf", "yulaf ezmesi", "oats", "oatmeal"],
        caloriesPer100g: 370,
        defaultUnit: "gram",
        servingUnit: "yemek kaşığı",
        servingGrams: 10, // 1 yk ~ 10g (~37 kcal), 1 su bardağı ~ 100g
        note: "Varsayılan olarak kuru, sade yulaf ezmesi baz alınmıştır."
    },
    // Varsayılan: Pişmemiş, çiğ beyaz pirinç (baldo/osmancık) baz alınmıştır.
    {
        id: "pirinc",
        name: "pirinç",
        aliases: ["pirinç", "pirinc", "rice", "white rice"],
        caloriesPer100g: 360,
        defaultUnit: "gram",
        servingUnit: "su bardağı",
        servingGrams: 180,
        note: "Varsayılan olarak pişmemiş kuru beyaz pirinç baz alınmıştır."
    },
    // Varsayılan: Pişmiş sade pirinç pilavı baz alınmıştır.
    {
        id: "pirinc_pilavi",
        name: "pirinç pilavı (pişmiş)",
        aliases: ["pirinç pilavı", "pilav", "cooked rice"],
        caloriesPer100g: 130,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 150,
        note: "Varsayılan olarak standart tereyağlı/sıvı yağlı pişmiş pilav baz alınmıştır."
    },
    // Varsayılan: Pişmemiş kuru durum buğdayı makarnası baz alınmıştır.
    {
        id: "makarna",
        name: "makarna",
        aliases: ["makarna", "pasta", "spagetti", "noodles", "çubuk makarna"],
        caloriesPer100g: 355,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 80,
        note: "Varsayılan olarak kuru, pişmemiş standart makarna baz alınmıştır."
    },
    // Varsayılan: Standart dilimlenmiş beyaz ekmek (~25-30g dilim) baz alınmıştır.
    {
        id: "ekmek",
        name: "beyaz ekmek",
        aliases: ["ekmek", "bread", "beyaz ekmek", "tost ekmeği", "somun ekmek"],
        caloriesPer100g: 265,
        defaultUnit: "dilim",
        servingUnit: "dilim",
        servingGrams: 30, // 1 dilim ~ 80 kcal
        note: "Varsayılan olarak standart beyaz somun / tost ekmeği dilimi baz alınmıştır."
    },
    {
        id: "tam_bugday_ekmegi",
        name: "tam buğday ekmeği",
        aliases: ["tam buğday ekmeği", "tam buğday", "whole wheat bread", "kepek ekmeği"],
        caloriesPer100g: 247,
        defaultUnit: "dilim",
        servingUnit: "dilim",
        servingGrams: 30,
        note: "Varsayılan olarak standart dilim tam buğday ekmeği baz alınmıştır."
    },
    {
        id: "patates",
        name: "patates",
        aliases: ["patates", "potato", "potatoes", "haşlanmış patates"],
        caloriesPer100g: 77,
        defaultUnit: "adet",
        servingUnit: "orta boy adet",
        servingGrams: 150, // 1 orta boy patates ~ 115 kcal
        note: "Varsayılan olarak çiğ/haşlanmış kabuksuz patates baz alınmıştır."
    },
    {
        id: "patates_kizartmasi",
        name: "patates kızartması",
        aliases: ["patates kızartması", "french fries", "kızarmış patates"],
        caloriesPer100g: 312,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 100,
        note: "Varsayılan olarak standart derin yağda kızartılmış patates baz alınmıştır."
    },

    // --- MEYVELER ---
    // Varsayılan: Orta boy taze muz (kabuksuz ~100-110g) baz alınmıştır.
    {
        id: "muz",
        name: "muz",
        aliases: ["muz", "banana", "bananas"],
        caloriesPer100g: 89,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 110, // 1 orta muz ~ 98 kcal
        note: "Varsayılan olarak 1 adet orta boy (kabuksuz 110g) taze muz baz alınmıştır."
    },
    // Varsayılan: Orta boy taze kırmızı/yeşil elma (~150g) baz alınmıştır.
    {
        id: "elma",
        name: "elma",
        aliases: ["elma", "apple", "apples"],
        caloriesPer100g: 52,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 150, // 1 orta elma ~ 78 kcal
        note: "Varsayılan olarak 1 adet orta boy taze elma baz alınmıştır."
    },
    {
        id: "cilek",
        name: "çilek",
        aliases: ["çilek", "cilek", "strawberry", "strawberries"],
        caloriesPer100g: 32,
        defaultUnit: "gram",
        servingUnit: "adet",
        servingGrams: 15,
        note: "Varsayılan olarak taze çilek baz alınmıştır."
    },
    {
        id: "portakal",
        name: "portakal",
        aliases: ["portakal", "orange"],
        caloriesPer100g: 47,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 130,
        note: "Varsayılan olarak 1 orta boy taze portakal baz alınmıştır."
    },
    {
        id: "avokado",
        name: "avokado",
        aliases: ["avokado", "avocado"],
        caloriesPer100g: 160,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 150,
        note: "Varsayılan olarak 1 orta boy taze avokado baz alınmıştır."
    },
    {
        id: "karadut",
        name: "karadut",
        aliases: ["karadut", "dut", "black mulberry", "mulberry"],
        caloriesPer100g: 43,
        defaultUnit: "gram",
        servingUnit: "avuç",
        servingGrams: 30,
        note: "Varsayılan olarak taze karadut baz alınmıştır."
    },

    // --- SEBZELER ---
    {
        id: "domates",
        name: "domates",
        aliases: ["domates", "tomato", "tomatoes"],
        caloriesPer100g: 18,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 120,
        note: "Varsayılan olarak taze kırmızı domates baz alınmıştır."
    },
    {
        id: "salatalik",
        name: "salatalık",
        aliases: ["salatalık", "salatalik", "hıyar", "cucumber"],
        caloriesPer100g: 15,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 120,
        note: "Varsayılan olarak taze salatalık baz alınmıştır."
    },
    {
        id: "havuc",
        name: "havuç",
        aliases: ["havuç", "havuc", "carrot", "carrots"],
        caloriesPer100g: 41,
        defaultUnit: "adet",
        servingUnit: "adet",
        servingGrams: 80,
        note: "Varsayılan olarak taze havuç baz alınmıştır."
    },
    {
        id: "brokoli",
        name: "brokoli",
        aliases: ["brokoli", "broccoli"],
        caloriesPer100g: 34,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 100,
        note: "Varsayılan olarak taze/haşlanmış brokoli baz alınmıştır."
    },
    {
        id: "ispanak",
        name: "ıspanak",
        aliases: ["ıspanak", "ispanak", "spinach"],
        caloriesPer100g: 23,
        defaultUnit: "gram",
        servingUnit: "porsiyon",
        servingGrams: 100,
        note: "Varsayılan olarak taze ıspanak baz alınmıştır."
    },

    // --- KURUYEMİŞLER VE YAĞLAR ---
    // Varsayılan: Saf sızma zeytinyağı (%100 bitkisel yağ) baz alınmıştır.
    {
        id: "zeytinyagi",
        name: "zeytinyağı",
        aliases: ["zeytinyağı", "zeytinyagi", "olive oil", "sıvı yağ", "oil"],
        caloriesPer100g: 884,
        defaultUnit: "yemek kaşığı",
        servingUnit: "yemek kaşığı",
        servingGrams: 10, // 1 yk ~ 10g / ~88 kcal
        note: "Varsayılan olarak sızma zeytinyağı baz alınmıştır."
    },
    {
        id: "ceviz",
        name: "ceviz içi",
        aliases: ["ceviz", "ceviz içi", "walnut", "walnuts"],
        caloriesPer100g: 654,
        defaultUnit: "gram",
        servingUnit: "adet",
        servingGrams: 5, // 1 tam ceviz içi ~ 5g (~33 kcal)
        note: "Varsayılan olarak kuru ceviz içi baz alınmıştır."
    },
    {
        id: "badem",
        name: "badem",
        aliases: ["badem", "almond", "almonds", "çiğ badem"],
        caloriesPer100g: 579,
        defaultUnit: "gram",
        servingUnit: "adet",
        servingGrams: 1.2,
        note: "Varsayılan olarak çiğ badem baz alınmıştır."
    },
    {
        id: "findik",
        name: "fındık",
        aliases: ["fındık", "findik", "hazelnut", "hazelnuts"],
        caloriesPer100g: 628,
        defaultUnit: "gram",
        servingUnit: "adet",
        servingGrams: 1.5,
        note: "Varsayılan olarak çiğ fındık içi baz alınmıştır."
    },
    // Varsayılan: %100 fıstık içeren şekersiz fıstık ezmesi baz alınmıştır.
    {
        id: "fistik_ezmesi",
        name: "fıstık ezmesi",
        aliases: ["fıstık ezmesi", "fistik ezmesi", "peanut butter"],
        caloriesPer100g: 588,
        defaultUnit: "yemek kaşığı",
        servingUnit: "yemek kaşığı",
        servingGrams: 16, // 1 yk ~ 16g (~94 kcal)
        note: "Varsayılan olarak katkısız/şekersiz fıstık ezmesi baz alınmıştır."
    },

    // --- DİĞER & TATLANDIRICILAR ---
    {
        id: "bal",
        name: "bal",
        aliases: ["bal", "honey"],
        caloriesPer100g: 304,
        defaultUnit: "yemek kaşığı",
        servingUnit: "yemek kaşığı",
        servingGrams: 20, // 1 yk ~ 20g (~60 kcal), 1 tatlı kaşığı ~ 7g (~21 kcal)
        note: "Varsayılan olarak doğal çiçek balı baz alınmıştır."
    },
    {
        id: "seker",
        name: "toz şeker",
        aliases: ["şeker", "seker", "toz şeker", "sugar", "white sugar"],
        caloriesPer100g: 387,
        defaultUnit: "tatlı kaşığı",
        servingUnit: "tatlı kaşığı",
        servingGrams: 5,
        note: "Varsayılan olarak beyaz kristal toz şeker baz alınmıştır."
    },
    {
        id: "cikolata",
        name: "çikolata",
        aliases: ["çikolata", "cikolata", "chocolate", "sütlü çikolata", "bitter çikolata"],
        caloriesPer100g: 535,
        defaultUnit: "gram",
        servingUnit: "kare",
        servingGrams: 6,
        note: "Varsayılan olarak standart sütlü çikolata baz alınmıştır."
    }
];

module.exports = {
    calorieDatabase
};
