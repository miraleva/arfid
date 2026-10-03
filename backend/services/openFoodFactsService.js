/**
 * Service: Open Food Facts Background Enrichment Service
 * 
 * Enriches presentation widgets (recipe and nutrition cards) with food images
 * fetched from the Open Food Facts API, backed by a persistent SQLite cache.
 * 
 * Architecture:
 * - Smart Fallback: First queries `tr.openfoodfacts.org` (Turkish local catalog & packaging).
 *   If TR yields no products (count === 0), or encounters error/503/timeout, automatically falls back
 *   to `world.openfoodfacts.org` (global catalog).
 * - Cache-Aside: Persistent SQLite storage with in-place UPDATE on expiry.
 * - Negative Caching: Non-existent foods cached with image_url = null to avoid wasteful retries.
 * - Non-blocking: 3-second timeout per domain, fails gracefully to default placeholders.
 */

const db = require("../db");
const { normalizeString } = require("../tools/utils/fuzzyMatch");
const { findLocalFoodImage } = require("../tools/data/localFoodImages");

const DEFAULT_TIMEOUT_MS = 3000;
const CACHE_TTL_SECONDS = 2 * 24 * 60 * 60; // 2 days (48 hours)
const DEFAULT_USER_AGENT = "ArfidChatbot/1.0 (contact@arfid.org)";

// Common Turkish to English mapping for food terms (for fallback global queries)
const TR_EN_FOOD_MAP = {
    "kirmizi biber": "red bell pepper",
    "biber": "bell pepper",
    "patates puresi": "mashed potatoes",
    "patates": "potato",
    "tavuk gogsu": "chicken breast",
    "tavuk": "chicken",
    "elma": "apple",
    "muz": "banana",
    "kasar peyniri": "kashar cheese",
    "beyaz peynir": "feta cheese",
    "peynir": "cheese",
    "domates": "tomato",
    "dana eti": "beef",
    "yumurta": "egg",
    "zeytinyagi": "olive oil",
    "yogurt": "yogurt"
};

// Dominant food modifier keywords that change the nature of the product if not requested by user
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
    "pizza", "lazanya", "lasagne", "makarna", "pasta", "erişte", "eriste", "noodle", "gnocchi", "noki", "mantı", "manti", "dumpling",
    "börek", "borek", "pide", "meatloaf", "kroket", "croquette", "nugget", "pane", "şnitzel", "schnitzel", "burger", "köfte", "kofte",
    "kızartması", "kizartmasi", "kızartma", "kizartma", "french fries", "churros",
    // Preserved / Pickled
    "zeytin", "olive", "turşu", "tursu", "pickle",
    // Canned proteins in base ingredients
    "ton balığı", "ton baligi", "tuna",
    // Descriptors changing pure state
    "aromalı", "aromali", "flavoured", "çeşnili", "cesnili", "seasoned",
    "dolgulu", "stuffed", "filled", "kaplamalı", "kaplamali"
];

// Dominant categories that change the nature of the product if not requested by user
const DOMINANT_CATEGORIES = [
    "en:chips-and-fries",
    "en:crisps",
    "en:potato-crisps",
    "en:appetizers",
    "en:snacks",
    "en:salty-snacks",
    "en:sweet-snacks",
    "en:biscuits-and-cakes",
    "en:chocolates",
    "en:candies",
    "en:sauces",
    "en:groceries",
    "en:pickles",
    "en:plant-based-pickles",
    "en:condiments",
    "en:meals",
    "en:prepared-meals",
    "en:frozen-prepared-foods"
];

/**
 * Checks whether a candidate product cleanly matches the user's search term.
 * Eliminates products that add intruder dominant food types (e.g. olive, chips, sauce)
 * in both the product name and Open Food Facts category tags (categories_tags).
 * 
 * @param {string} searchTerm 
 * @param {Object|string} product - Candidate product object or product name
 * @returns {{ match: boolean, reason?: string }}
 */
function isCleanMatch(searchTerm, product) {
    const productName = typeof product === "object" && product !== null ? product.product_name : product;
    if (!productName || typeof productName !== "string") {
        return { match: false, reason: "Product name empty" };
    }

    const normSearch = normalizeString(searchTerm).toLowerCase();
    const normProd = normalizeString(productName).toLowerCase();

    const searchTokens = normSearch.split(/\s+/).filter(Boolean);
    const prodTokens = normProd.split(/\s+/).filter(Boolean);

    // 1. Intruder modifier check in Name
    for (const mod of DOMINANT_MODIFIERS) {
        const normMod = normalizeString(mod).toLowerCase();
        const userWanted = searchTokens.some(st => st.includes(normMod) || normMod.includes(st));
        const prodHas = normProd.includes(normMod);

        if (!userWanted && prodHas) {
            return {
                match: false,
                reason: `Intruder modifier '${mod}' in product name`
            };
        }
    }

    // 2. Intruder Category Tags Check (categories_tags)
    if (typeof product === "object" && Array.isArray(product.categories_tags)) {
        const catTags = product.categories_tags.map(c => c.toLowerCase());
        
        // E.g. if user didn't ask for chips/crisps/snacks/sauces/pickles, eliminate those categories
        for (const domCat of DOMINANT_CATEGORIES) {
            const catWord = domCat.replace(/^en:/, "").replace(/-/g, " ");
            const userWantedCat = searchTokens.some(st => catWord.includes(st) || st.includes(catWord));

            if (!userWantedCat && catTags.includes(domCat)) {
                return {
                    match: false,
                    reason: `Intruder category tag '${domCat}' not requested in search term`
                };
            }
        }
    }

    // Helper for Turkish consonant alternation and suffix tolerance
    function tokenMatches(searchToken, prodToken) {
        if (searchToken === prodToken || searchToken.includes(prodToken) || prodToken.includes(searchToken)) {
            return true;
        }
        const stemA = searchToken.replace(/[kğtd]$/, "").slice(0, 4);
        const stemB = prodToken.replace(/[kğtd]$/, "").slice(0, 4);
        return stemA.length >= 3 && stemA === stemB;
    }

    // 3. Token overlap: Ensure user's key words actually exist in the product
    const matched = searchTokens.filter(st => prodTokens.some(pt => tokenMatches(st, pt)));
    const coverage = matched.length / searchTokens.length;

    const requiredCoverage = searchTokens.length <= 2 ? 0.9 : 0.65;
    if (coverage < requiredCoverage) {
        return {
            match: false,
            reason: `Insufficient token coverage (${Math.round(coverage * 100)}%)`
        };
    }

    return { match: true };
}

/**
 * Searches SQLite cache for a normalized query term.
 * 
 * @param {string} normalizedTerm 
 * @returns {Promise<Object|null>} Cache record or null if not found
 */
function getCachedProduct(normalizedTerm) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT * FROM off_image_cache WHERE query_term = ?",
            [normalizedTerm],
            (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            }
        );
    });
}

/**
 * Saves or updates a product record (image & nutrition) in SQLite cache.
 * Uses ON CONFLICT to update in-place when expired or re-queried.
 * 
 * @param {string} normalizedTerm 
 * @param {string|null} imageUrl 
 * @param {string|null} productName 
 * @param {string|null} sourceUrl 
 * @param {string|null} [sourceDomain=null] 
 * @param {number} [ttlSeconds=CACHE_TTL_SECONDS] 
 * @param {Object} [nutrition={}] 
 * @returns {Promise<void>}
 */
function saveCachedProduct(normalizedTerm, imageUrl, productName, sourceUrl, sourceDomain = null, ttlSeconds = CACHE_TTL_SECONDS, nutrition = {}) {
    // Backwards compatibility if 5th argument was ttlSeconds
    if (typeof sourceDomain === "number") {
        ttlSeconds = sourceDomain;
        sourceDomain = null;
    }

    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + ttlSeconds;

        const cal = nutrition && typeof nutrition.calories_100g === "number" ? nutrition.calories_100g : null;
        const protein = nutrition && typeof nutrition.protein_100g === "number" ? nutrition.protein_100g : null;
        const carbs = nutrition && typeof nutrition.carbs_100g === "number" ? nutrition.carbs_100g : null;
        const fat = nutrition && typeof nutrition.fat_100g === "number" ? nutrition.fat_100g : null;

        const sql = `
            INSERT INTO off_image_cache (
                query_term, image_url, product_name, source_url, source_domain, 
                calories_100g, protein_100g, carbs_100g, fat_100g, 
                fetched_at, expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(query_term) DO UPDATE SET
                image_url = COALESCE(excluded.image_url, off_image_cache.image_url),
                product_name = COALESCE(excluded.product_name, off_image_cache.product_name),
                source_url = COALESCE(excluded.source_url, off_image_cache.source_url),
                source_domain = COALESCE(excluded.source_domain, off_image_cache.source_domain),
                calories_100g = COALESCE(excluded.calories_100g, off_image_cache.calories_100g),
                protein_100g = COALESCE(excluded.protein_100g, off_image_cache.protein_100g),
                carbs_100g = COALESCE(excluded.carbs_100g, off_image_cache.carbs_100g),
                fat_100g = COALESCE(excluded.fat_100g, off_image_cache.fat_100g),
                fetched_at = excluded.fetched_at,
                expires_at = excluded.expires_at
        `;

        db.run(sql, [normalizedTerm, imageUrl, productName, sourceUrl, sourceDomain, cal, protein, carbs, fat, now, expiresAt], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

/**
 * Performs HTTP search against Open Food Facts API for a specific domain.
 * 
 * @param {string} searchTerm 
 * @param {string} [domain="tr.openfoodfacts.org"]
 * @param {Object} [options={}]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Object>} Search result envelope with status and product details
 */
async function fetchFromOpenFoodFacts(searchTerm, domain = "tr.openfoodfacts.org", options = {}) {
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const userAgent = process.env.OFF_USER_AGENT || DEFAULT_USER_AGENT;
    const encodedTerm = encodeURIComponent(searchTerm.trim());
    const url = `https://${domain}/cgi/search.pl?search_terms=${encodedTerm}&search_simple=1&action=process&json=1&page_size=200&fields=product_name,image_front_url,image_url,url,code,nutriments,categories_tags`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    console.log(`[OpenFoodFacts] [START] Request -> domain: ${domain} | term: "${searchTerm}" | url: ${url}`);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": userAgent,
                "Accept": "application/json"
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[OpenFoodFacts] [END - FAILED] [${domain}] HTTP ${response.status} for "${searchTerm}"`);
            return {
                ok: false,
                status: response.status,
                error: `HTTP ${response.status}`,
                domain
            };
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            console.warn(`[OpenFoodFacts] [END - FAILED] [${domain}] Non-JSON response (${contentType}) for "${searchTerm}"`);
            return {
                ok: false,
                status: response.status,
                error: "Non-JSON response",
                domain
            };
        }

        const data = await response.json();
        const products = Array.isArray(data.products) ? data.products : [];
        const count = typeof data.count === "number" ? data.count : products.length;

        console.log(`[OpenFoodFacts] [PROCESSING] [${domain}] "${searchTerm}" -> Returned ${count} products (${products.length} in current page)`);

        // Helper to extract clean nutrition from a product
        function extractNutrition(p) {
            if (!p || !p.nutriments) return null;
            const n = p.nutriments;
            const kcal = typeof n["energy-kcal_100g"] === "number"
                ? n["energy-kcal_100g"]
                : (typeof n["energy-kcal"] === "number"
                    ? n["energy-kcal"]
                    : (typeof n["energy_100g"] === "number" ? Math.round(n["energy_100g"] / 4.184) : null));

            return {
                calories_100g: typeof kcal === "number" && !isNaN(kcal) ? Math.round(kcal) : null,
                protein_100g: typeof n.proteins_100g === "number" ? parseFloat(n.proteins_100g.toFixed(1)) : null,
                carbs_100g: typeof n.carbohydrates_100g === "number" ? parseFloat(n.carbohydrates_100g.toFixed(1)) : null,
                fat_100g: typeof n.fat_100g === "number" ? parseFloat(n.fat_100g.toFixed(1)) : null
            };
        }

        // Separate products into cleanly matching products and remaining products
        const cleanProducts = products.filter(p => isCleanMatch(searchTerm, p).match);

        // Sort candidate pool: prioritize products in pure produce categories and shortest name
        cleanProducts.sort((a, b) => {
            const pureCats = ["en:vegetables", "en:potatoes", "en:fresh-vegetables", "en:fruits", "en:fresh-fruits"];
            const aHasPure = Array.isArray(a.categories_tags) && a.categories_tags.some(c => pureCats.includes(c));
            const bHasPure = Array.isArray(b.categories_tags) && b.categories_tags.some(c => pureCats.includes(c));
            if (aHasPure && !bHasPure) return -1;
            if (!aHasPure && bHasPure) return 1;

            // Secondary sort: shorter product name is usually less processed (e.g. "Superfresh Patates" vs "Churros Patates Tırtıklı...")
            const aLen = (a.product_name || "").length;
            const bLen = (b.product_name || "").length;
            return aLen - bLen;
        });

        const candidatePool = cleanProducts.length > 0 ? cleanProducts : [];

        // 1. Try finding a cleanly matching product with a valid front/general image
        for (const p of candidatePool) {
            const img = p.image_front_url || p.image_url;
            const prodName = p.product_name || searchTerm;
            const sourceUrl = p.url || (p.code ? `https://${domain}/product/${p.code}` : `https://${domain}`);
            const nutrition = extractNutrition(p);

            if (img && typeof img === "string" && img.startsWith("http")) {
                console.log(`[OpenFoodFacts] [END - SUCCESS] [${domain}] "${searchTerm}" -> Clean Product Found: "${prodName}" | Image: ${img} | Cal/100g: ${nutrition ? nutrition.calories_100g : "N/A"}`);
                return {
                    ok: true,
                    count: count,
                    image_url: img,
                    product_name: prodName,
                    source_url: sourceUrl,
                    domain,
                    nutrition
                };
            }
        }

        // 2. If no image found among clean candidates, but clean candidate exists with nutrition
        if (candidatePool.length > 0) {
            const firstP = candidatePool[0];
            const nutrition = extractNutrition(firstP);
            const prodName = firstP.product_name || searchTerm;
            const sourceUrl = firstP.url || (firstP.code ? `https://${domain}/product/${firstP.code}` : `https://${domain}`);

            console.log(`[OpenFoodFacts] [END - NO IMAGE BUT CLEAN PRODUCT] [${domain}] "${searchTerm}" -> "${prodName}" Nutrition: ${JSON.stringify(nutrition)}`);
            return {
                ok: true,
                count: count,
                image_url: null,
                product_name: prodName,
                source_url: sourceUrl,
                domain,
                nutrition
            };
        }

        // 200 OK, but no product found
        console.log(`[OpenFoodFacts] [END - NO PRODUCT] [${domain}] "${searchTerm}" -> 0 products found`);
        return {
            ok: true,
            count: count,
            image_url: null,
            product_name: null,
            source_url: null,
            domain,
            nutrition: null
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
            console.warn(`[OpenFoodFacts] [END - TIMEOUT] [${domain}] Request timed out after ${timeoutMs}ms for "${searchTerm}"`);
            return { ok: false, error: "TIMEOUT", domain };
        } else {
            console.warn(`[OpenFoodFacts] [END - ERROR] [${domain}] Network error for "${searchTerm}": ${err.message}`);
            return { ok: false, error: err.message, domain };
        }
    }
}

/**
 * Searches for a product image using smart fallback (TR -> World) and cache-aside pattern.
 * Respects cache expiration by updating expired entries in place.
 * 
 * @param {string} rawTerm 
 * @param {Object} [options={}]
 * @returns {Promise<Object|null>} Product info with image_url, or null if unavailable
 */
async function searchProductImage(rawTerm, options = {}) {
    if (!rawTerm || typeof rawTerm !== "string" || rawTerm.trim() === "") {
        return null;
    }

    const normalizedTerm = normalizeString(rawTerm);
    if (!normalizedTerm) {
        return null;
    }

    // 0. Check Curated Local Food Images (Skip OFF entirely for pure/whole fresh produce)
    const localFood = findLocalFoodImage(rawTerm);
    if (localFood && localFood.imageUrl) {
        console.log(`[LocalFoodLibrary] [HIT] "${rawTerm}" yerel küratörlü kütüphaneden getirildi (OFF atlandı) -> Görsel: ${localFood.imageUrl} | Ürün: "${localFood.name}"`);
        return {
            image_url: localFood.imageUrl,
            product_name: localFood.name,
            source_url: "https://unsplash.com",
            source_domain: "local_curated",
            attribution: localFood.attribution || "Unsplash",
            from_cache: false,
            from_local_library: true
        };
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        // 1. Check SQLite Cache
        const cached = await getCachedProduct(normalizedTerm);

        if (cached) {
            // Check if entry is still fresh
            if (cached.expires_at && cached.expires_at > now) {
                // Cache hit and still fresh
                if (!cached.image_url) {
                    // Negative cache hit (item was previously verified not found)
                    console.log(`[OpenFoodFacts Cache] [HIT - NEGATIVE] "${normalizedTerm}" daha önce arandı ve görsel bulunamadı.`);
                    return null;
                }
                console.log(`[OpenFoodFacts Cache] [HIT] "${normalizedTerm}" önbellekten getirildi -> Görsel URL: ${cached.image_url} | Ürün: "${cached.product_name}" | Kaynak: ${cached.source_url}`);
                return {
                    image_url: cached.image_url,
                    product_name: cached.product_name,
                    source_url: cached.source_url,
                    source_domain: cached.source_domain || null,
                    from_cache: true
                };
            }
            // Entry has expired -> do not delete, re-query API and UPDATE in place
            console.log(`[OpenFoodFacts] Cache expired for "${normalizedTerm}", refreshing via smart fallback...`);
        }

        // 2. Step 1: Query tr.openfoodfacts.org first (Turkish local market & packaging)
        console.log(`[OpenFoodFacts] Searching for "${rawTerm}" on tr.openfoodfacts.org...`);
        const trResult = await fetchFromOpenFoodFacts(rawTerm, "tr.openfoodfacts.org", options);

        if (trResult.ok && trResult.image_url) {
            console.log(`[OpenFoodFacts] Found on tr.openfoodfacts.org for "${rawTerm}" (World skipped)`);
            await saveCachedProduct(
                normalizedTerm,
                trResult.image_url,
                trResult.product_name,
                trResult.source_url,
                "tr.openfoodfacts.org",
                options.ttlSeconds || CACHE_TTL_SECONDS,
                trResult.nutrition
            );

            return {
                image_url: trResult.image_url,
                product_name: trResult.product_name,
                source_url: trResult.source_url,
                source_domain: "tr.openfoodfacts.org",
                from_cache: false,
                nutrition: trResult.nutrition
            };
        }

        // 3. Step 2: Fallback to world.openfoodfacts.org if TR yielded no results or encountered error/timeout
        const trReason = !trResult.ok
            ? `failed (${trResult.error || trResult.status})`
            : (trResult.count === 0 ? "returned 0 products" : "had no product images");
        console.log(`[OpenFoodFacts] TR domain ${trReason} for "${rawTerm}". Falling back to world.openfoodfacts.org...`);

        // Check if there is an English equivalent for broader matching on world catalog
        const enQuery = TR_EN_FOOD_MAP[normalizedTerm] || rawTerm;
        const worldResult = await fetchFromOpenFoodFacts(enQuery, "world.openfoodfacts.org", options);

        if (worldResult.ok && worldResult.image_url) {
            console.log(`[OpenFoodFacts] Fallback succeeded on world.openfoodfacts.org for "${rawTerm}" (query: "${enQuery}")`);
            await saveCachedProduct(
                normalizedTerm,
                worldResult.image_url,
                worldResult.product_name,
                worldResult.source_url,
                "world.openfoodfacts.org",
                options.ttlSeconds || CACHE_TTL_SECONDS,
                worldResult.nutrition
            );

            return {
                image_url: worldResult.image_url,
                product_name: worldResult.product_name,
                source_url: worldResult.source_url,
                source_domain: "world.openfoodfacts.org",
                from_cache: false,
                nutrition: worldResult.nutrition
            };
        }

        // 4. If both domains cleanly confirmed no image (count === 0 / no image), negative-cache it
        if (trResult.ok && worldResult.ok && !worldResult.image_url) {
            console.log(`[OpenFoodFacts] Both domains yielded no image for "${rawTerm}", saving negative cache`);
            await saveCachedProduct(
                normalizedTerm,
                null,
                worldResult.product_name || trResult.product_name || null,
                worldResult.source_url || trResult.source_url || null,
                "none",
                options.ttlSeconds || CACHE_TTL_SECONDS,
                worldResult.nutrition || trResult.nutrition || {}
            );
        } else {
            console.log(`[OpenFoodFacts] Lookup failed for "${rawTerm}" without clean responses. Defaulting to placeholder.`);
        }

        return null;
    } catch (err) {
        console.error(`[OpenFoodFacts] Unexpected error in searchProductImage:`, err.message);
        return null;
    }
}

/**
 * Enriches a presentation widget with an image from Open Food Facts.
 * Modifies and returns the widget object defensively.
 * 
 * @param {Object} widget 
 * @param {Object} [options={}]
 * @returns {Promise<Object>} The enriched widget (or original if unmatchable)
 */
async function enrichWidget(widget, options = {}) {
    if (!widget || typeof widget !== "object" || !widget.data) {
        return widget;
    }

    try {
        let searchTerm = "";

        if (widget.type === "nutrition") {
            searchTerm = widget.data.food_name || widget.title || "";
        } else if (widget.type === "recipe") {
            // In recipes, prioritize the primary ingredient, then fallback to title
            const ingredients = Array.isArray(widget.data.ingredients) ? widget.data.ingredients : [];
            if (ingredients.length > 0 && ingredients[0].name) {
                searchTerm = ingredients[0].name;
            } else {
                searchTerm = widget.title || "";
            }
        }

        const incomingMsg = options.userText ? `"${options.userText}"` : "(Belirtilmedi)";
        console.log(`[OpenFoodFacts Enrichment] [Widget: ${widget.type.toUpperCase()}] Gelen Mesaj: ${incomingMsg} | Çıkarılan Food Name: "${searchTerm}"`);

        if (!searchTerm) {
            return widget;
        }

        const imageInfo = await searchProductImage(searchTerm, options);

        if (imageInfo && imageInfo.image_url) {
            // Attach top-level image_url for fast direct access
            widget.data.image_url = imageInfo.image_url;

            // Update image_placeholder structure for seamless compatibility
            if (!widget.data.image_placeholder || typeof widget.data.image_placeholder !== "object") {
                widget.data.image_placeholder = {};
            }
            widget.data.image_placeholder.image_url = imageInfo.image_url;
            widget.data.image_placeholder.source_url = imageInfo.source_url || (imageInfo.source_domain ? `https://${imageInfo.source_domain}` : "https://openfoodfacts.org");
            widget.data.image_placeholder.source_name = imageInfo.from_local_library ? "Arfid Kütüphanesi (Unsplash)" : "Open Food Facts";
            widget.data.image_placeholder.source_domain = imageInfo.source_domain || null;
            widget.data.image_placeholder.product_name = imageInfo.product_name || searchTerm;

            const sourceDesc = imageInfo.from_local_library ? "Yerel Kütüphane (Unsplash)" : (imageInfo.from_cache ? "Cache" : "Canlı API");
            console.log(`[OpenFoodFacts Enrichment] [BAŞARILI] Widget'a atanan Görsel Linki: ${imageInfo.image_url} (Kaynak: ${sourceDesc})`);
        } else {
            console.log(`[OpenFoodFacts Enrichment] [GÖRSEL YOK] "${searchTerm}" için görsel bulunamadı, varsayılan placeholder kullanılacak.`);
        }

        return widget;
    } catch (enrichErr) {
        console.warn("[OpenFoodFacts] Widget enrichment failed, returning base widget:", enrichErr.message);
        return widget;
    }
}

/**
 * Verifies if a food exists in Open Food Facts (TR or World catalog).
 * Used for semantic validity checks when adding manual dietary profile preferences.
 * 
 * @param {string} rawTerm - Food name to verify
 * @param {Object} [options={}] - Options (e.g. timeoutMs)
 * @returns {Promise<{ exists: boolean, verified: boolean, networkError: boolean, productName?: string }>}
 */
async function checkFoodExists(rawTerm, options = {}) {
    if (!rawTerm || typeof rawTerm !== "string" || rawTerm.trim() === "") {
        return { exists: false, verified: false, networkError: false };
    }

    const normalizedTerm = normalizeString(rawTerm);
    if (!normalizedTerm) {
        return { exists: false, verified: false, networkError: false };
    }

    // 0. Check Curated Local Food Images (If it's in our curated library, it definitely exists)
    const localFood = findLocalFoodImage(rawTerm);
    if (localFood) {
        return {
            exists: true,
            verified: true,
            networkError: false,
            productName: localFood.name,
            fromLocalLibrary: true
        };
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        // 1. Check SQLite Cache
        const cached = await getCachedProduct(normalizedTerm);
        if (cached && cached.expires_at && cached.expires_at > now) {
            if (cached.source_domain === "not_found") {
                return { exists: false, verified: true, networkError: false, fromCache: true };
            }
            if (cached.image_url || cached.product_name) {
                return { exists: true, verified: true, networkError: false, productName: cached.product_name || rawTerm, fromCache: true };
            }
        }

        // 2. Query TR Catalog
        const trResult = await fetchFromOpenFoodFacts(rawTerm, "tr.openfoodfacts.org", options);
        if (trResult.ok && trResult.count > 0) {
            await saveCachedProduct(
                normalizedTerm,
                trResult.image_url || null,
                trResult.product_name || rawTerm,
                trResult.source_url || null,
                "tr.openfoodfacts.org",
                options.ttlSeconds || CACHE_TTL_SECONDS
            );
            return { exists: true, verified: true, networkError: false, productName: trResult.product_name || rawTerm };
        }

        // 3. Fallback to World Catalog
        const worldResult = await fetchFromOpenFoodFacts(rawTerm, "world.openfoodfacts.org", options);
        if (worldResult.ok && worldResult.count > 0) {
            await saveCachedProduct(
                normalizedTerm,
                worldResult.image_url || null,
                worldResult.product_name || rawTerm,
                worldResult.source_url || null,
                "world.openfoodfacts.org",
                options.ttlSeconds || CACHE_TTL_SECONDS
            );
            return { exists: true, verified: true, networkError: false, productName: worldResult.product_name || rawTerm };
        }

        // 4. If both domains responded cleanly with count === 0
        if (trResult.ok && worldResult.ok && trResult.count === 0 && worldResult.count === 0) {
            await saveCachedProduct(
                normalizedTerm,
                null,
                null,
                null,
                "not_found",
                options.ttlSeconds || CACHE_TTL_SECONDS
            );
            return { exists: false, verified: true, networkError: false };
        }

        // 5. Network / Timeout Error on both
        return { exists: false, verified: false, networkError: true, error: worldResult.error || trResult.error };
    } catch (err) {
        console.warn(`[OpenFoodFacts] checkFoodExists error for "${rawTerm}":`, err.message);
        return { exists: false, verified: false, networkError: true, error: err.message };
    }
}

/**
 * Retrieves food nutrition values (calories, protein, carbs, fat per 100g)
 * using SQLite cache first, then smart fallback to Open Food Facts API.
 * 
 * @param {string} rawTerm - Food name
 * @param {Object} [options={}] - Options
 * @returns {Promise<Object|null>} Normalized food nutrition entry or null
 */
async function getFoodNutrition(rawTerm, options = {}) {
    if (!rawTerm || typeof rawTerm !== "string" || rawTerm.trim() === "") {
        return null;
    }

    const normalizedTerm = normalizeString(rawTerm);
    if (!normalizedTerm) return null;

    const now = Math.floor(Date.now() / 1000);

    try {
        // 1. Check Cache
        const cached = await getCachedProduct(normalizedTerm);
        if (cached && cached.expires_at && cached.expires_at > now) {
            if (cached.source_domain === "not_found") {
                return null;
            }
            if (typeof cached.calories_100g === "number") {
                console.log(`[OpenFoodFacts Nutrition] [CACHE HIT] "${rawTerm}" -> ${cached.calories_100g} kcal/100g`);
                return {
                    name: cached.product_name || rawTerm,
                    caloriesPer100g: cached.calories_100g,
                    proteinPer100g: cached.protein_100g || 0,
                    carbsPer100g: cached.carbs_100g || 0,
                    fatPer100g: cached.fat_100g || 0,
                    image_url: cached.image_url,
                    source_url: cached.source_url,
                    source_domain: cached.source_domain,
                    note: `Open Food Facts (${cached.source_domain || "global"}) verisi baz alınmıştır.`,
                    fromCache: true
                };
            }
        }

        // 2. Query TR Catalog
        console.log(`[OpenFoodFacts Nutrition] Searching "${rawTerm}" on tr.openfoodfacts.org...`);
        const trResult = await fetchFromOpenFoodFacts(rawTerm, "tr.openfoodfacts.org", options);

        if (trResult.ok && trResult.nutrition && typeof trResult.nutrition.calories_100g === "number") {
            console.log(`[OpenFoodFacts Nutrition] Found on TR -> ${trResult.nutrition.calories_100g} kcal/100g`);
            await saveCachedProduct(
                normalizedTerm,
                trResult.image_url || null,
                trResult.product_name || rawTerm,
                trResult.source_url || null,
                "tr.openfoodfacts.org",
                options.ttlSeconds || CACHE_TTL_SECONDS,
                trResult.nutrition
            );
            return {
                name: trResult.product_name || rawTerm,
                caloriesPer100g: trResult.nutrition.calories_100g,
                proteinPer100g: trResult.nutrition.protein_100g || 0,
                carbsPer100g: trResult.nutrition.carbs_100g || 0,
                fatPer100g: trResult.nutrition.fat_100g || 0,
                image_url: trResult.image_url,
                source_url: trResult.source_url,
                source_domain: "tr.openfoodfacts.org",
                note: "Open Food Facts Türkiye kataloğu verisi baz alınmıştır.",
                fromCache: false
            };
        }

        // 3. Fallback to World Catalog
        const enQuery = TR_EN_FOOD_MAP[normalizedTerm] || rawTerm;
        console.log(`[OpenFoodFacts Nutrition] TR had no nutrition for "${rawTerm}", trying world.openfoodfacts.org (query: "${enQuery}")...`);
        const worldResult = await fetchFromOpenFoodFacts(enQuery, "world.openfoodfacts.org", options);

        if (worldResult.ok && worldResult.nutrition && typeof worldResult.nutrition.calories_100g === "number") {
            console.log(`[OpenFoodFacts Nutrition] Found on World -> ${worldResult.nutrition.calories_100g} kcal/100g`);
            await saveCachedProduct(
                normalizedTerm,
                worldResult.image_url || null,
                worldResult.product_name || rawTerm,
                worldResult.source_url || null,
                "world.openfoodfacts.org",
                options.ttlSeconds || CACHE_TTL_SECONDS,
                worldResult.nutrition
            );
            return {
                name: worldResult.product_name || rawTerm,
                caloriesPer100g: worldResult.nutrition.calories_100g,
                proteinPer100g: worldResult.nutrition.protein_100g || 0,
                carbsPer100g: worldResult.nutrition.carbs_100g || 0,
                fatPer100g: worldResult.nutrition.fat_100g || 0,
                image_url: worldResult.image_url,
                source_url: worldResult.source_url,
                source_domain: "world.openfoodfacts.org",
                note: "Open Food Facts Global kataloğu verisi baz alınmıştır.",
                fromCache: false
            };
        }

        return null;
    } catch (err) {
        console.warn(`[OpenFoodFacts Nutrition] Error fetching nutrition for "${rawTerm}":`, err.message);
        return null;
    }
}

module.exports = {
    searchProductImage,
    checkFoodExists,
    enrichWidget,
    getFoodNutrition,
    getCachedProduct,
    saveCachedProduct,
    fetchFromOpenFoodFacts,
    DEFAULT_TIMEOUT_MS,
    CACHE_TTL_SECONDS
};
