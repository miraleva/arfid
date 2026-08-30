require("dotenv").config();
const { getDietitianResponse } = require("./services/dietitianService");

async function testEdgeCaseA() {
    console.log("Testing Edge Case A (Unmatched ingredient)...");
    const res6 = await getDietitianResponse("100 gram ejder meyvesi pitaya ve 1 adet muzun kalorisini hesaplar mısın?");
    console.log("\nResponse 6:", res6.assistant_response);
}

testEdgeCaseA();
