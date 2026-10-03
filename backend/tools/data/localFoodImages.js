/**
 * localFoodImages.js
 * Küratörlü, doğrulanmış yerel gıda görsel kütüphanesi.
 * Temel/saf gıdalar için Open Food Facts'e gitmeden doğrudan yüksek kaliteli,
 * saf gıda görsellerini servis eder.
 */

const LOCAL_FOOD_IMAGES = [
  {
    id: 'patates',
    name: 'Patates',
    aliases: ['patates', 'taze patates', 'haşlanmış patates', 'patatesi', 'patatesler', 'patates haşlama'],
    imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'kirmizi_biber',
    name: 'Kırmızı Biber',
    aliases: ['kırmızı biber', 'kapya biber', 'kirmizi biber', 'kırmızı kapya biber', 'tatlı kırmızı biber', 'kırmızı biberi'],
    imageUrl: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'elma',
    name: 'Elma',
    aliases: ['elma', 'kırmızı elma', 'yeşil elma', 'taze elma', 'elmayı', 'elmalar'],
    imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'muz',
    name: 'Muz',
    aliases: ['muz', 'yerli muz', 'taze muz', 'muzu', 'muzlar'],
    imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'tavuk_gogsu',
    name: 'Tavuk Göğsü',
    aliases: ['tavuk göğsü', 'tavuk gogsu', 'tavuk fileto', 'çiğ tavuk göğsü', 'haşlanmış tavuk göğsü', 'tavuk göğsü ızgara'],
    imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'yumurta',
    name: 'Yumurta',
    aliases: ['yumurta', 'haşlanmış yumurta', 'tavuk yumurtası', 'taze yumurta', 'yumurtası', 'yumurtalar'],
    imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'sut',
    name: 'Süt',
    aliases: ['süt', 'inek sütü', 'tam yağlı süt', 'yarım yağlı süt', 'sütü', 'sut'],
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'domates',
    name: 'Domates',
    aliases: ['domates', 'salkım domates', 'taze domates', 'domatesi', 'domatesler'],
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'havuc',
    name: 'Havuç',
    aliases: ['havuç', 'taze havuç', 'havucu', 'havuclar', 'havuc'],
    imageUrl: 'https://images.unsplash.com/photo-1447175008436-054170c2e979?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'yogurt',
    name: 'Yoğurt',
    aliases: ['yoğurt', 'süzme yoğurt', 'doğal yoğurt', 'ev yoğurdu', 'yoğurdu', 'yogurt'],
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'pirinc',
    name: 'Pirinç',
    aliases: ['pirinç', 'beyaz pirinç', 'baldo pirinç', 'pirinci', 'pirinc'],
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'brokoli',
    name: 'Brokoli',
    aliases: ['brokoli', 'taze brokoli', 'brokolisi'],
    imageUrl: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'ispanak',
    name: 'Ispanak',
    aliases: ['ıspanak', 'taze ıspanak', 'ispanak', 'ıspanağı'],
    imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'salatalik',
    name: 'Salatalık',
    aliases: ['salatalık', 'hıyar', 'taze salatalık', 'salatalığı', 'salatalik'],
    imageUrl: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'sogan',
    name: 'Soğan',
    aliases: ['soğan', 'kuru soğan', 'beyaz soğan', 'soğanı', 'sogan'],
    imageUrl: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'sarimsak',
    name: 'Sarımsak',
    aliases: ['sarımsak', 'taze sarımsak', 'sarımsağı', 'sarimsak'],
    imageUrl: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'mantar',
    name: 'Mantar',
    aliases: ['mantar', 'kültür mantarı', 'taze mantar', 'mantarı', 'mantarlar'],
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'kuru_fasulye',
    name: 'Kuru Fasulye',
    aliases: ['kuru fasulye', 'beyaz fasulye', 'çiğ kuru fasulye', 'fasulye'],
    imageUrl: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'kirmizi_mercimek',
    name: 'Kırmızı Mercimek',
    aliases: ['kırmızı mercimek', 'kirmizi mercimek', 'mercimek'],
    imageUrl: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'zeytinyagi',
    name: 'Zeytinyağı',
    aliases: ['zeytinyağı', 'sızma zeytinyağı', 'natürel sızma zeytinyağı', 'zeytinyagi'],
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'yulaf',
    name: 'Yulaf',
    aliases: ['yulaf', 'yulaf ezmesi', 'yulafı'],
    imageUrl: 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  },
  {
    id: 'ceviz',
    name: 'Ceviz',
    aliases: ['ceviz', 'ceviz içi', 'kabuklu ceviz', 'cevizi'],
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&auto=format&fit=crop&q=80',
    source: 'local_curated',
    attribution: 'Unsplash'
  }
];

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Arama terimini yerel listede sorgular.
 * @param {string} searchTerm 
 * @returns {object|null}
 */
function findLocalFoodImage(searchTerm) {
  if (!searchTerm) return null;
  const cleanSearch = normalizeText(searchTerm);
  if (!cleanSearch) return null;

  for (const item of LOCAL_FOOD_IMAGES) {
    // 1. Doğrudan id veya name eşleşmesi
    if (normalizeText(item.name) === cleanSearch || normalizeText(item.id) === cleanSearch) {
      return item;
    }
    // 2. Alias'lar içinde tam eşleşme
    for (const alias of item.aliases) {
      const cleanAlias = normalizeText(alias);
      if (cleanAlias === cleanSearch) {
        return item;
      }
    }
  }

  // 3. İçerik eşleşmesi (örn: "taze patates aldım" -> "patates")
  // Ancak tersine durumları engellemek için kelime sınırları ile kontrol
  const searchWords = cleanSearch.split(' ');
  for (const item of LOCAL_FOOD_IMAGES) {
    for (const alias of item.aliases) {
      const cleanAlias = normalizeText(alias);
      // Tek kelimelik alias ise arama kelimelerinden biriyle tam uyuşmalı (örn. "patates")
      // Ancak "patates cipsi" gibi kompozit kelimeleri elemeli
      if (!cleanAlias.includes(' ') && searchWords.includes(cleanAlias)) {
        // Eğer arama içinde cips, bisküvi, çorba, börek gibi kompozit kelimeler varsa yerel saf görsel eşleşmesin
        const COMPOSITE_MODIFIERS = ['cips', 'corba', 'borek', 'kek', 'tatli', 'sos', 'tursu', 'kroket', 'pane'];
        const hasComposite = searchWords.some(w => COMPOSITE_MODIFIERS.includes(w));
        if (!hasComposite) {
          return item;
        }
      }
    }
  }

  return null;
}

module.exports = {
  LOCAL_FOOD_IMAGES,
  findLocalFoodImage,
  normalizeText
};
