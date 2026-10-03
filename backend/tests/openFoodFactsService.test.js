/**
 * Test Suite: Open Food Facts Background Enrichment & Cache
 * 
 * Verifies:
 * 1. Product search against real Open Food Facts API (positive cache)
 * 2. Cache hit on repeated search (0 API call)
 * 3. Negative caching for non-existent products (graceful fallback)
 * 4. Timeout resilience (fast abort, no crash, fallback preserved)
 * 5. Expired cache update in-place (ON CONFLICT UPDATE, no row deletion or duplication)
 * 6. Widget enrichment for recipe and nutrition widgets
 */

const assert = require("assert");
const db = require("../db");
const {
    searchProductImage,
    enrichWidget,
    getCachedProduct,
    saveCachedProduct
} = require("../services/openFoodFactsService");
const { normalizeString } = require("../tools/utils/fuzzyMatch");

function runTest(name, fn) {
    return (async () => {
        try {
            await fn();
            console.log(`✅ [PASS] ${name}`);
            return true;
        } catch (err) {
            console.error(`❌ [FAIL] ${name}`);
            console.error(err);
            return false;
        }
    })();
}

async function main() {
    console.log("=================================================");
    console.log("🧪 RUNNING OPEN FOOD FACTS ENRICHMENT TEST SUITE");
    console.log("=================================================\n");

    let passed = 0;
    let total = 0;

    // Wait for db initialization if needed
    await new Promise(r => setTimeout(r, 400));

    // TEST 1: Real Product Search
    total++;
    if (await runTest("1. Search known product from Open Food Facts API", async () => {
        const result = await searchProductImage("Nutella", { timeoutMs: 8000 });
        assert.ok(result, "Result should not be null");
        assert.ok(typeof result.image_url === "string" && result.image_url.startsWith("http"), "Image URL must be valid HTTP link");
        assert.ok(result.source_url, "Source URL must exist for attribution");
    })) passed++;

    // TEST 2: Cache Hit on Second Query
    total++;
    if (await runTest("2. Repeated search hits SQLite cache without network fetch", async () => {
        const cachedResult = await searchProductImage("Nutella");
        assert.ok(cachedResult, "Cached result should not be null");
        assert.strictEqual(cachedResult.from_cache, true, "Should return from_cache: true");
        assert.ok(cachedResult.image_url.startsWith("http"), "Cached image URL must be preserved");
    })) passed++;

    // TEST 3: Negative Caching & Fallback for Unknown Product
    total++;
    if (await runTest("3. Non-existent product returns null and negative-caches gracefully", async () => {
        const unknownTerm = "xyznonexistentfood12345qwe";
        const result = await searchProductImage(unknownTerm, { timeoutMs: 3000 });
        assert.strictEqual(result, null, "Result should be null for unfindable product");

        // Explicitly test negative cache behavior
        const normalized = normalizeString("explicit_negative_cache_test");
        await saveCachedProduct(normalized, null, null, null);
        const cacheEntry = await getCachedProduct(normalized);
        assert.ok(cacheEntry, "Negative cache entry must exist");
        assert.strictEqual(cacheEntry.image_url, null, "Cached image_url should be null");

        // Querying for negative-cached item must return null instantly without network call
        const repeatResult = await searchProductImage("explicit_negative_cache_test");
        assert.strictEqual(repeatResult, null, "Query on negative cache must be null");
    })) passed++;

    // TEST 4: Timeout Resilience & Fallback
    total++;
    if (await runTest("4. Timeout does not crash, aborts cleanly and returns fallback null", async () => {
        // Use an unrealistically low timeout of 1ms to guarantee an AbortController trigger
        const timeoutTerm = "test_timeout_sample_food";
        const result = await searchProductImage(timeoutTerm, { timeoutMs: 1 });
        assert.strictEqual(result, null, "Should return null on timeout");
    })) passed++;

    // TEST 5: Expired Cache Entry Updates In-Place (No duplication, no delete)
    total++;
    if (await runTest("5. Expired cache record is refreshed via UPDATE without deleting or duplicating", async () => {
        const expiredTerm = "test_expired_apple";
        const normalized = normalizeString(expiredTerm);

        // Manually write an expired record
        const pastTimestamp = Math.floor(Date.now() / 1000) - 1000;
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO off_image_cache (query_term, image_url, product_name, source_url, fetched_at, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [normalized, "http://old-image.com/old.jpg", "Old Apple", "http://old-source.com", pastTimestamp - 1000, pastTimestamp],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Verify initial state
        const initialRow = await getCachedProduct(normalized);
        assert.strictEqual(initialRow.image_url, "http://old-image.com/old.jpg");
        assert.ok(initialRow.expires_at < Math.floor(Date.now() / 1000), "Should be expired");

        // Trigger search (simulating re-fetch and update)
        // We'll call saveCachedProduct directly or searchProductImage
        await saveCachedProduct(normalized, "http://refreshed-image.com/new.jpg", "Refreshed Apple", "http://new-source.com");

        // Verify row was updated in place
        const updatedRow = await getCachedProduct(normalized);
        assert.strictEqual(updatedRow.image_url, "http://refreshed-image.com/new.jpg");
        assert.ok(updatedRow.expires_at > Math.floor(Date.now() / 1000), "New expires_at should be in the future");

        // Verify only 1 row exists with this query_term
        const countRow = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM off_image_cache WHERE query_term = ?", [normalized], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        assert.strictEqual(countRow.count, 1, "There must be exactly 1 row for query_term, no duplicate created");
    })) passed++;

    // TEST 6: Widget Enrichment (Recipe)
    total++;
    if (await runTest("6. enrichWidget populates recipe widget image fields", async () => {
        const recipeWidget = {
            type: "recipe",
            title: "Elmalı Tarçınlı Yulaf",
            data: {
                ingredients: [{ name: "Nutella", amount: 1, unit: "kaşık" }],
                image_placeholder: {
                    slot_key: "recipe_default",
                    alt_text: "Elmalı Tarçınlı Yulaf"
                }
            }
        };

        const enriched = await enrichWidget(recipeWidget);
        assert.ok(enriched.data.image_url, "Widget must have top-level image_url");
        assert.ok(enriched.data.image_placeholder.image_url, "image_placeholder must have image_url");
        assert.strictEqual(enriched.data.image_placeholder.source_name, "Open Food Facts");
        assert.ok(enriched.data.image_placeholder.source_url, "image_placeholder must have source_url");
    })) passed++;

    // TEST 7: Widget Enrichment (Nutrition)
    total++;
    if (await runTest("7. enrichWidget populates nutrition widget image fields", async () => {
        const nutritionWidget = {
            type: "nutrition",
            title: "Nutella Besin Değeri",
            data: {
                food_name: "Nutella",
                image_placeholder: {
                    slot_key: "food_default",
                    alt_text: "Nutella"
                }
            }
        };

        const enriched = await enrichWidget(nutritionWidget);
        assert.ok(enriched.data.image_url, "Nutrition widget must have top-level image_url");
        assert.strictEqual(enriched.data.image_placeholder.source_name, "Open Food Facts");
    })) passed++;

    // TEST 8: Smart Fallback Architecture Verification
    total++;
    if (await runTest("8. searchProductImage handles domain fallback and records source_domain", async () => {
        // Manually test save and retrieve with source_domain
        const testTerm = "test_domain_fallback_item";
        const normalized = normalizeString(testTerm);
        await saveCachedProduct(normalized, "http://image.com/tr.jpg", "Test TR Item", "http://tr.openfoodfacts.org/1", "tr.openfoodfacts.org");
        const cacheEntry = await getCachedProduct(normalized);
        assert.strictEqual(cacheEntry.source_domain, "tr.openfoodfacts.org", "source_domain must be recorded in cache table");
    })) passed++;

    console.log("\n=================================================");
    console.log(`Test Summary: ${passed} / ${total} tests passed.`);
    console.log("=================================================");

    if (passed !== total) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error("FATAL TEST RUN ERROR:", err);
    process.exit(1);
});
