/**
 * Comprehensive RAG Test Suite Master Runner
 * 
 * Sequentially orchestrates all modular test suites under tests/rag/:
 * 1. Ground Truth Retrieval (01_groundTruth.test.js)
 * 2. Paraphrase & Semantic Resilience (02_paraphrase.test.js)
 * 3. Chunk Discrimination & Isolation (03_chunkIsolation.test.js)
 * 4. Chunk Integrity & Static Validation (04_chunkIntegrity.test.js)
 * 5. Embedding Consistency & Determinism (05_embeddingConsistency.test.js)
 * 6. Latency & Performance SLA (06_performance.test.js)
 * 7. End-to-End RAG with LLM-as-Judge (07_llmAsJudge.test.js)
 */

const { verifyPreflightServices, printSummaryTable } = require("./rag/_shared");

const testGroundTruthRetrieval = require("./rag/01_groundTruth.test");
const testParaphraseResilience = require("./rag/02_paraphrase.test");
const testChunkDiscrimination = require("./rag/03_chunkIsolation.test");
const testChunkIntegrity = require("./rag/04_chunkIntegrity.test");
const testEmbeddingConsistency = require("./rag/05_embeddingConsistency.test");
const testPerformanceAndLatency = require("./rag/06_performance.test");
const testEndToEndRagWithLLMJudge = require("./rag/07_llmAsJudge.test");

async function runAllRagTests() {
    const startTime = Date.now();

    console.log("\n================================================================================");
    console.log("🧪 ARFID RAG SİSTEMİ KAPSAMLI TEST SUITE BAŞLATILIYOR (MASTER RUNNER)");
    console.log(`📅 Tarih: ${new Date().toLocaleString("tr-TR")}`);
    console.log("================================================================================\n");

    // 0. Ön Kontroller (Port 5001 & 3000)
    await verifyPreflightServices();

    const suiteResults = [];

    // 1-7 Test Senaryolarını Sırayla Çalıştır
    suiteResults.push(await testGroundTruthRetrieval());
    suiteResults.push(await testParaphraseResilience());
    suiteResults.push(await testChunkDiscrimination());
    suiteResults.push(await testChunkIntegrity());
    suiteResults.push(await testEmbeddingConsistency());
    suiteResults.push(await testPerformanceAndLatency());
    suiteResults.push(await testEndToEndRagWithLLMJudge());

    // Final Raporlama ve Çıkış Kodu
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    printSummaryTable(suiteResults, totalDuration);
}

// Doğrudan çalıştırma
if (require.main === module) {
    runAllRagTests();
}

module.exports = runAllRagTests;
