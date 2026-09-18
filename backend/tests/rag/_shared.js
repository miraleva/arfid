/**
 * Shared Utilities and Infrastructure for RAG Test Suite
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:5001";
const BACKEND_PORT = process.env.PORT || 3000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

function createCategoryTracker(categoryName) {
    let passed = 0;
    let total = 0;
    const records = [];

    function record(isPass, description, detail = "") {
        total++;
        if (isPass) {
            passed++;
            console.log(`  ✅ [PASS] ${description}${detail ? ` (${detail})` : ""}`);
        } else {
            console.error(`  ❌ [FAIL] ${description}${detail ? ` (${detail})` : ""}`);
        }
        records.push({ isPass, description, detail });
    }

    function summarize() {
        console.log(`  👉 Kategori Sonucu: ${passed}/${total} test geçti.\n`);
        return {
            name: categoryName,
            passed,
            total,
            status: passed === total && total > 0 ? "PASS" : "FAIL",
            records
        };
    }

    return { record, summarize, getStats: () => ({ passed, total }) };
}

/**
 * Pre-flight Check: Verifies that both retrieval.py (port 5001) and server.js (port 3000) are alive.
 */
async function verifyPreflightServices() {
    console.log("================================================================================");
    console.log("🔍 ÖN KONTROL: RAG (retrieval.py) ve Backend (server.js) Servisleri Kontrol Ediliyor...");
    console.log("================================================================================");

    let ragAlive = false;
    let backendAlive = false;

    // 1. RAG Service Check (port 5001)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${RAG_SERVICE_URL}/`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            ragAlive = true;
            console.log(`  ✅ RAG Retrieval Servisi AKTİF: ${RAG_SERVICE_URL} [${data.service || "ok"}]`);
        }
    } catch (e) {
        ragAlive = false;
    }

    // 2. Backend Server Check (port 3000)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${BACKEND_URL}/`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.status === 200 || res.status === 404) {
            backendAlive = true;
            console.log(`  ✅ Backend Express Servisi AKTİF: ${BACKEND_URL} [HTTP ${res.status}]`);
        }
    } catch (e) {
        backendAlive = false;
    }

    if (!ragAlive || !backendAlive) {
        console.error("\n❌ [KRİTİK HATA] Testlerin çalışması için gerekli servisler ayakta değil!");
        if (!ragAlive) console.error(`  - RAG Servisi kapalı (${RAG_SERVICE_URL})`);
        if (!backendAlive) console.error(`  - Backend Servisi kapalı (${BACKEND_URL})`);

        console.error("\nLütfen testten önce servisleri şu komutla başlatın:");
        console.error("  👉 Terminalde: cd backend && npm start");
        console.error("     (server.js başladığında otomatik olarak retrieval.py servisini de ayağa kaldırır)");
        console.error("  👉 Veya manuel RAG için: cd backend && python rag/retrieval.py\n");
        process.exit(1);
    }

    console.log("  🚀 Tüm servisler hazır! Test senaryoları başlatılıyor...\n");
}

/**
 * Prints final summary table and exits process with appropriate code.
 */
function printSummaryTable(suiteResults, totalDuration) {
    let totalPass = 0;
    let totalTests = 0;

    console.log("================================================================================");
    console.log("📊 GENEL TEST ÖZET TABLOSU");
    console.log("================================================================================");
    console.log(
        "Kategori Adı".padEnd(38) + 
        "| Toplam".padEnd(10) + 
        "| Geçen".padEnd(9) + 
        "| Kalan".padEnd(9) + 
        "| Durum"
    );
    console.log("--------------------------------------------------------------------------------");

    for (const cat of suiteResults) {
        totalPass += cat.passed;
        totalTests += cat.total;
        const failed = cat.total - cat.passed;
        const statusEmoji = cat.status === "PASS" ? "✅ PASS" : "❌ FAIL";
        console.log(
            cat.name.padEnd(38) + 
            `| ${String(cat.total).padEnd(8)}` + 
            `| ${String(cat.passed).padEnd(7)}` + 
            `| ${String(failed).padEnd(7)}` + 
            `| ${statusEmoji}`
        );
    }

    console.log("================================================================================");
    console.log(`🏁 TOPLAM: ${totalPass} / ${totalTests} test başarılı. Toplam Süre: ${totalDuration}s`);
    console.log("================================================================================\n");

    if (totalPass !== totalTests || totalTests === 0) {
        console.error("❌ Bazı testler başarısız oldu. Lütfen yukarıdaki hata kayıtlarını inceleyin.");
        process.exit(1);
    } else {
        console.log("🎉 Tüm RAG testleri başarıyla PASS oldu! Sistem üretime/kullanıma hazır.");
        process.exit(0);
    }
}

/**
 * Helper to run any individual test module standalone from command line.
 */
async function runStandalone(testFn) {
    await verifyPreflightServices();
    const t0 = Date.now();
    const res = await testFn();
    const duration = ((Date.now() - t0) / 1000).toFixed(2);
    printSummaryTable([res], duration);
}

module.exports = {
    RAG_SERVICE_URL,
    BACKEND_URL,
    BACKEND_PORT,
    createCategoryTracker,
    verifyPreflightServices,
    printSummaryTable,
    runStandalone
};
