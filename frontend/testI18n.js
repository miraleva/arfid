/**
 * Automated Verification Script for Bilingual (TR/EN) Frontend Support
 * Tests:
 * 1. Default locale (TR) on mainPage, signIn, and signUp
 * 2. Locale switch to EN via /set-locale/en?returnTo=...
 * 3. Session persistence across subsequent page requests
 * 4. Content translation accuracy (Turkish vs English titles & labels)
 * 5. Locale switch back to TR
 */

const assert = require("assert");

const BASE_URL = "http://localhost:4000";

async function verifyI18n() {
    console.log("=================================================");
    console.log("🧪 RUNNING FRONTEND i18n VERIFICATION SUITE");
    console.log("=================================================\n");

    let sessionCookie = "";

    // Helper: fetch with session cookie persistence
    async function request(path, options = {}) {
        const headers = options.headers || {};
        if (sessionCookie) {
            headers["Cookie"] = sessionCookie;
        }

        const res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
            redirect: "manual" // Handle redirects manually to capture cookies
        });

        // Capture set-cookie
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
            // Keep the connect.sid cookie
            const match = setCookie.match(/connect\.sid=[^;]+/);
            if (match) {
                sessionCookie = match[0];
            }
        }

        return res;
    }

    // TEST 1: Default landing page is in Turkish
    console.log("1. Checking Default Landing Page (TR)...");
    const r1 = await request("/");
    assert.strictEqual(r1.status, 200);
    const html1 = await r1.text();
    assert.ok(html1.includes("ARFID Nedir?"), "Landing page should have Turkish 'ARFID Nedir?'");
    assert.ok(html1.includes("Asistanla Konuş"), "Landing page should have Turkish CTA button");
    assert.ok(html1.includes('class="lang-btn active" \n       title="Türkçe"'), "TR toggle button should be active");
    console.log("✅ [PASS] Default landing page rendered in Turkish successfully.");

    // TEST 2: Switch to English via /set-locale/en?returnTo=/
    console.log("\n2. Switching locale to EN (/set-locale/en?returnTo=/)...");
    const r2 = await request("/set-locale/en?returnTo=/");
    assert.strictEqual(r2.status, 302, "Should return 302 redirect");
    assert.strictEqual(r2.headers.get("location"), "/", "Should redirect to returnTo path");

    // Fetch landing page after switch
    const r3 = await request("/");
    const html3 = await r3.text();
    assert.ok(html3.includes("What is ARFID?"), "Landing page should now have English 'What is ARFID?'");
    assert.ok(html3.includes("Talk to Assistant"), "Landing page should now have English CTA 'Talk to Assistant'");
    assert.ok(html3.includes("Stepping into Nutrition"), "Hero subtitle/badge should be English");
    assert.ok(html3.includes('class="lang-btn active" \n       title="English"'), "EN toggle button should be active");
    console.log("✅ [PASS] Successfully switched to English; landing page translated.");

    // TEST 3: Navigate to /signin - verify locale persists in English across pages
    console.log("\n3. Navigating to /signin (verifying session persistence)...");
    const r4 = await request("/signin");
    assert.strictEqual(r4.status, 200);
    const html4 = await r4.text();
    assert.ok(html4.includes("Welcome Back!"), "Sign In should display 'Welcome Back!' in English");
    assert.ok(html4.includes("Remember me"), "Sign In should display 'Remember me' in English");
    assert.ok(html4.includes("Please enter a valid email address."), "Validation script should embed English message");
    console.log("✅ [PASS] /signin page inherited EN locale from session.");

    // TEST 4: Navigate to /signup - verify locale persists in English
    console.log("\n4. Navigating to /signup (verifying session persistence)...");
    const r5 = await request("/signup");
    assert.strictEqual(r5.status, 200);
    const html5 = await r5.text();
    assert.ok(html5.includes("Create an account"), "Sign Up should display 'Create an account' in English");
    assert.ok(html5.includes("Confirm Password"), "Sign Up should display 'Confirm Password' in English");
    assert.ok(html5.includes("Passwords do not match."), "Validation script should embed English mismatch message");
    console.log("✅ [PASS] /signup page inherited EN locale from session.");

    // TEST 5: Switch back to TR from /signin with returnTo=/signin
    console.log("\n5. Switching back to TR from /signin (/set-locale/tr?returnTo=/signin)...");
    const r6 = await request("/set-locale/tr?returnTo=/signin");
    assert.strictEqual(r6.status, 302);
    assert.strictEqual(r6.headers.get("location"), "/signin");

    const r7 = await request("/signin");
    const html7 = await r7.text();
    assert.ok(html7.includes("Tekrar Hoş Geldiniz!"), "Sign In should now display 'Tekrar Hoş Geldiniz!'");
    assert.ok(html7.includes("Beni Hatırla"), "Sign In should now display 'Beni Hatırla'");
    assert.ok(html7.includes("Lütfen geçerli bir e-posta adresi girin."), "Validation script should embed Turkish message");
    console.log("✅ [PASS] Successfully switched back to Turkish and returned to /signin.");

    console.log("\n=================================================");
    console.log("🎉 ALL i18n & SHARED COMPONENT TESTS PASSED!");
    console.log("=================================================\n");
}

verifyI18n().catch(err => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});
