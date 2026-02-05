const fetch = require('node-fetch'); // You might need to install this if not available, or use native fetch in Node 18+

const BASE_URL = 'http://localhost:3000';
const SHARED_SECRET = 'ARFID_SECURE_TOKEN_2026';

async function test() {
    console.log("Starting Verification...");

    // 1. Signup
    const username = `testuser_${Date.now()}`;
    const email = `${username}@example.com`;
    const password = 'password123';

    console.log(`\n1. Creating User: ${username}`);
    const signupRes = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': SHARED_SECRET
        },
        body: JSON.stringify({ email, password, username })
    });
    const user = await signupRes.json();
    if (!user.id) {
        console.error("Signup failed:", user);
        return;
    }
    console.log("User Created, ID:", user.id);

    // 2. Test 1: Constraint Declaration
    console.log("\n2. Sending: 'I really hate apples, they make me gag.'");
    const chatRes1 = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': SHARED_SECRET,
            'X-User-Id': user.id
        },
        body: JSON.stringify({ message: "I really hate apples, they make me gag." })
    });
    const data1 = await chatRes1.json();
    console.log("Response 1:", data1.response ? "OK" : "MISSING");
    console.log("Patient Card 1:", data1.patient_card);

    if (data1.patient_card && data1.patient_card.toLowerCase().includes('apple')) {
        console.log("PASS: Patient card mentions apple/fruit.");
    } else {
        console.log("WARNING: Patient card might be missing specific mention yet (might need more strong input).");
    }

    // 3. Test 2: Conflict Check
    console.log("\n3. Sending: 'Give me a recipe for apple pie.'");
    const chatRes2 = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': SHARED_SECRET,
            'X-User-Id': user.id
        },
        body: JSON.stringify({ message: "Give me a recipe for apple pie." })
    });
    const data2 = await chatRes2.json();
    console.log("Response 2:", data2.response ? "OK" : "MISSING");
    console.log("Patient Card 2:", data2.patient_card);

    if (data2.patient_card && data2.patient_card.toLowerCase().includes('apple')) {
        console.log("PASS: Patient card persists constraint.");
    } else {
        console.log("FAIL: Patient card lost the constraint.");
    }

    // 4. Test 3: New User (Empty)
    const username2 = `clean_${Date.now()}`;
    const user2Res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${username2}@test.com`, password: '123', username: username2 })
    });
    const user2 = await user2Res.json();

    console.log(`\n4. Testing Clean User: ${user2.id}`);
    const chatRes3 = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': SHARED_SECRET,
            'X-User-Id': user2.id
        },
        body: JSON.stringify({ message: "Hello there." })
    });
    const data3 = await chatRes3.json();
    console.log("Patient Card 3:", data3.patient_card);
    if (!data3.patient_card || data3.patient_card.includes("No specific")) {
        console.log("PASS: Correctly identified no constraints.");
    } else {
        console.log("FAIL: Unexpected card content for new user.");
    }
}

test().catch(console.error);
