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

const DEFAULT_TIMEOUT_MS = 3000;
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_USER_AGENT = "ArfidChatbot - Web - Surum 1.0 (iletisim@arfid.local)";

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
 * Saves or updates a product image record in SQLite cache.
 * Uses ON CONFLICT to update in-place when expired or re-queried.
 * 
 * @param {string} normalizedTerm 
 * @param {string|null} imageUrl 
 * @param {string|null} productName 
 * @param {string|null} sourceUrl 
 * @param {string|null} [sourceDomain=null] 
 * @param {number} [ttlSeconds=CACHE_TTL_SECONDS] 
 * @returns {Promise<void>}
 */
function saveCachedProduct(normalizedTerm, imageUrl, productName, sourceUrl, sourceDomain = null, ttlSeconds = CACHE_TTL_SECONDS) {
    // Backwards compatibility if 5th argument was ttlSeconds
    if (typeof sourceDomain === "number") {
        ttlSeconds = sourceDomain;
        sourceDomain = null;
    }

    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + ttlSeconds;

        const sql = `
            INSERT INTO off_image_cache (query_term, image_url, product_name, source_url, source_domain, fetched_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(query_term) DO UPDATE SET
                image_url = excluded.image_url,
                product_name = excluded.product_name,
                source_url = excluded.source_url,
                source_domain = excluded.source_domain,
                fetched_at = excluded.fetched_at,
                expires_at = excluded.expires_at
        `;

        db.run(sql, [normalizedTerm, imageUrl, productName, sourceUrl, sourceDomain, now, expiresAt], (err) => {
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
    const url = `https://${domain}/cgi/search.pl?search_terms=${encodedTerm}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,image_front_url,image_url,url,code`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
            console.warn(`[OpenFoodFacts] [${domain}] HTTP ${response.status} for "${searchTerm}"`);
            return {
                ok: false,
                status: response.status,
                error: `HTTP ${response.status}`,
                domain
            };
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            console.warn(`[OpenFoodFacts] [${domain}] Non-JSON response (${contentType}) for "${searchTerm}"`);
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

        // Find the first product with a valid front image or general image
        for (const p of products) {
            const img = p.image_front_url || p.image_url;
            if (img && typeof img === "string" && img.startsWith("http")) {
                const prodName = p.product_name || searchTerm;
                const sourceUrl = p.url || (p.code ? `https://${domain}/product/${p.code}` : `https://${domain}`);
                return {
                    ok: true,
                    count: count,
                    image_url: img,
                    product_name: prodName,
                    source_url: sourceUrl,
                    domain
                };
            }
        }

        // 200 OK, but no product or no product with valid image
        return {
            ok: true,
            count: count,
            image_url: null,
            product_name: null,
            source_url: null,
            domain
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
            console.warn(`[OpenFoodFacts] [${domain}] Request timed out after ${timeoutMs}ms for "${searchTerm}"`);
            return { ok: false, error: "TIMEOUT", domain };
        } else {
            console.warn(`[OpenFoodFacts] [${domain}] Network error for "${searchTerm}":`, err.message);
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
                    return null;
                }
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
                options.ttlSeconds || CACHE_TTL_SECONDS
            );

            return {
                image_url: trResult.image_url,
                product_name: trResult.product_name,
                source_url: trResult.source_url,
                source_domain: "tr.openfoodfacts.org",
                from_cache: false
            };
        }

        // 3. Step 2: Fallback to world.openfoodfacts.org if TR yielded no results or encountered error/timeout
        const trReason = !trResult.ok
            ? `failed (${trResult.error || trResult.status})`
            : (trResult.count === 0 ? "returned 0 products" : "had no product images");
        console.log(`[OpenFoodFacts] TR domain ${trReason} for "${rawTerm}". Falling back to world.openfoodfacts.org...`);

        const worldResult = await fetchFromOpenFoodFacts(rawTerm, "world.openfoodfacts.org", options);

        if (worldResult.ok && worldResult.image_url) {
            console.log(`[OpenFoodFacts] Fallback succeeded on world.openfoodfacts.org for "${rawTerm}"`);
            await saveCachedProduct(
                normalizedTerm,
                worldResult.image_url,
                worldResult.product_name,
                worldResult.source_url,
                "world.openfoodfacts.org",
                options.ttlSeconds || CACHE_TTL_SECONDS
            );

            return {
                image_url: worldResult.image_url,
                product_name: worldResult.product_name,
                source_url: worldResult.source_url,
                source_domain: "world.openfoodfacts.org",
                from_cache: false
            };
        }

        // 4. If both domains cleanly confirmed no image (count === 0 / no image), negative-cache it
        if (trResult.ok && worldResult.ok && !worldResult.image_url) {
            console.log(`[OpenFoodFacts] Both domains yielded no image for "${rawTerm}", saving negative cache`);
            await saveCachedProduct(
                normalizedTerm,
                null,
                null,
                null,
                "none",
                options.ttlSeconds || CACHE_TTL_SECONDS
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
            widget.data.image_placeholder.source_name = "Open Food Facts";
            widget.data.image_placeholder.source_domain = imageInfo.source_domain || null;
            widget.data.image_placeholder.product_name = imageInfo.product_name || searchTerm;
        }

        return widget;
    } catch (enrichErr) {
        console.warn("[OpenFoodFacts] Widget enrichment failed, returning base widget:", enrichErr.message);
        return widget;
    }
}

module.exports = {
    searchProductImage,
    enrichWidget,
    getCachedProduct,
    saveCachedProduct,
    fetchFromOpenFoodFacts,
    DEFAULT_TIMEOUT_MS,
    CACHE_TTL_SECONDS
};
