/**
 * 7. Uçtan Uca RAG Entegrasyon Testi (LLM-as-Judge)
 * Gerçek kullanıcı sorgusuyla dietitianService üzerinden tam akış (RAG + Gemini) çalıştırılır.
 * Üretilen asistan cevabı bağımsız bir Gemini hakem çağrısına gönderilerek kaynağa sadakat (faithfulness) denetlenir.
 */

const { createCategoryTracker, runStandalone } = require("./_shared");
const { getDietitianResponse } = require("../../services/dietitianService");
const { getRagContext } = require("../../rag/ragClient");
const { geminiResponse } = require("../../services/aiService");

async function testEndToEndRagWithLLMJudge() {
    console.log("--------------------------------------------------------------------------------");
    console.log("📌 7. Uçtan Uca RAG Entegrasyon Testi (LLM-as-Judge Faithfulness Kontrolü)");
    console.log("--------------------------------------------------------------------------------");
    const tracker = createCategoryTracker("7. LLM-as-Judge Entegrasyon");

    const userMessage = "Can you suggest a delicious sweet potato pancakes recipe from the book?";

    try {
        console.log(`  💬 Kullanıcı Mesajı: "${userMessage}"`);

        // 1. RAG Bağlamını Doğrudan Al
        console.log("  🔍 1/3 RAG Bağlamı çekiliyor...");
        const ragContext = await getRagContext(userMessage);
        tracker.record(
            typeof ragContext === "string" && ragContext.length > 0,
            "RAG Bağlamı Çekildi",
            `${ragContext.length} karakter context oluşturuldu`
        );

        // 2. Tam Diyetisyen Akışını Çalıştır
        console.log("  🤖 2/3 Diyetisyen Asistanı (dietitianService + RAG + Tool Calls) çalıştırılıyor...");
        const testUserId = 99999;
        const dietitianResult = await getDietitianResponse(userMessage, testUserId);

        const responseText = dietitianResult?.assistant_response || "";
        tracker.record(
            responseText.length > 0 && !responseText.includes("trouble connecting to my knowledge base"),
            "Diyetisyen Cevabı Üretildi",
            `Cevap uzunluğu: ${responseText.length} karakter`
        );

        console.log(`  📄 Asistan Cevabı Önizleme: "${responseText.slice(0, 140).replace(/\n/g, " ")}..."`);

        // 3. Bağımsız Gemini Hakem (LLM-as-Judge) Çağrısı
        console.log("  ⚖️  3/3 Bağımsız Gemini Hakem (LLM-as-Judge) Değerlendirmesi Yapılıyor...");
        const judgePrompt = `
Sen titiz bir hakem (LLM-as-Judge) modelsin. Görevin, bir diyetisyen asistanının kullanıcının sorusuna verdiği cevabın, arkasındaki RAG bilgi tabanına ve kaynak tariflere sadık (faithful) kalıp kalmadığını denetlemektir.

KAYNAK METİN (RAG Context):
${ragContext || "Kaynak bağlamı bulunamadı"}

DİYETİSYENİN CEVABI:
${responseText}

KULLANICI SORUSU:
${userMessage}

DEĞERLENDİRME KRİTERİ:
Bu diyetisyen cevabı, sağlanan kaynak metinlere (RAG bağlamı) ve ARFID/çocuk beslenme ilkelerine dayanıyor mu? Kaynakta önerilen tarif konseptine (örneğin sebze püresi gizlenmiş tatlı/kek) sadık mı?
Cevapta kaynakla tamamen çelişen veya uydurma zararlı içerik var mı?

LÜTFEN SADECE ŞU FORMATTA CEVAP VER:
KARAR: [EVET veya HAYIR]
GEREKÇE: [1-2 cümlelik net açıklama]
        `.trim();

        const judgeRawResponse = await geminiResponse(judgePrompt);
        console.log(`\n  --- ⚖️  HAKEM RAPORU ---`);
        console.log(`  ${judgeRawResponse.trim().replace(/\n/g, "\n  ")}`);
        console.log(`  ------------------------\n`);

        const isFaithful = judgeRawResponse.toUpperCase().includes("KARAR: EVET") || 
                           (judgeRawResponse.toUpperCase().includes("EVET") && !judgeRawResponse.toUpperCase().includes("KARAR: HAYIR"));

        tracker.record(
            isFaithful,
            "LLM-as-Judge Faithfulness (Kaynağa Sadakat) Onayı",
            isFaithful ? "Hakem cevabın kaynakla uyumlu olduğunu onayladı" : "Hakem cevabı reddetti"
        );

    } catch (err) {
        tracker.record(false, "LLM-as-Judge Entegrasyon Testi", `Hata: ${err.message}`);
    }

    return tracker.summarize();
}

if (require.main === module) {
    runStandalone(testEndToEndRagWithLLMJudge);
}

module.exports = testEndToEndRagWithLLMJudge;
