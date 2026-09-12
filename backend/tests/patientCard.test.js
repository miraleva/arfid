/**
 * Patient Card Generation & Constraint Persistence Test
 * Verifies that user food constraints declared in chat are properly summarized
 * in the Patient Card and persist across conversation turns.
 */

const assert = require("assert");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SHARED_SECRET = process.env.SHARED_SECRET || "ARFID_SECURE_TOKEN_2026";

async function runPatientCardTests() {
    console.log("=================================================");
    console.log("🧪 RUNNING PATIENT CARD & CONSTRAINT TEST SUITE");
    console.log("=================================================\n");

    let passed = 0;
    let total = 0;

    function record(pass, msg) {
        total++;
        if (pass) {
            console.log(`✅ [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${msg}`);
        }
    }

    try {
        // 1. Signup test user
        const username = `testuser_${Date.now()}`;
        const email = `${username}@example.com`;
        const password = "password123";

        console.log(`1. Creating Test User: ${username}`);
        const signupRes = await fetch(`${BASE_URL}/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Token": SHARED_SECRET
            },
            body: JSON.stringify({ email, password, username })
        });
        const user = await signupRes.json();
        record(user && user.id, `User created successfully with ID: ${user.id}`);

        // 2. Test 1: Declare food constraint
        console.log("\n2. Sending: 'I really hate apples, they make me gag.'");
        const chatRes1 = await fetch(`${BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Token": SHARED_SECRET,
                "X-User-Id": String(user.id)
            },
            body: JSON.stringify({ message: "I really hate apples, they make me gag." })
        });
        const data1 = await chatRes1.json();
        const hasAppleInCard1 = data1.patient_card && data1.patient_card.toLowerCase().includes("apple");
        record(hasAppleInCard1, "Patient card captures declared food constraint (Apple)");

        // 3. Test 2: Persistence in subsequent chat turn
        console.log("\n3. Sending follow-up turn: 'Give me a recipe for apple pie.'");
        const chatRes2 = await fetch(`${BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Token": SHARED_SECRET,
                "X-User-Id": String(user.id)
            },
            body: JSON.stringify({ message: "Give me a recipe for apple pie." })
        });
        const data2 = await chatRes2.json();
        const hasAppleInCard2 = data2.patient_card && data2.patient_card.toLowerCase().includes("apple");
        record(hasAppleInCard2, "Patient card persists constraint across chat turns");

        // 4. Test 3: New clean user has no false constraints
        const username2 = `clean_${Date.now()}`;
        const user2Res = await fetch(`${BASE_URL}/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Token": SHARED_SECRET
            },
            body: JSON.stringify({ email: `${username2}@test.com`, password: "123", username: username2 })
        });
        const user2 = await user2Res.json();

        console.log(`\n4. Testing Clean User ID: ${user2.id}`);
        const chatRes3 = await fetch(`${BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Token": SHARED_SECRET,
                "X-User-Id": String(user2.id)
            },
            body: JSON.stringify({ message: "Hello there." })
        });
        const data3 = await chatRes3.json();
        const cleanCard = !data3.patient_card || data3.patient_card.includes("No specific");
        record(cleanCard, "Clean user correctly returns empty/default patient card without constraints");

        console.log("\n=================================================");
        console.log(`Test Summary: ${passed} / ${total} tests passed.`);
        console.log("=================================================\n");

        if (passed !== total) {
            process.exit(1);
        }

    } catch (err) {
        console.error("Patient Card Test failed with exception:", err.message);
        process.exit(1);
    }
}

runPatientCardTests();
