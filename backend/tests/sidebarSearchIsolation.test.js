/**
 * Test verifying search filtering isolation between "Sohbetler" (Conversations)
 * and "Tariflerim" (Saved Widgets) tabs.
 */

const assert = require("assert");

console.log("=================================================");
console.log("🧪 RUNNING SIDEBAR SEARCH ISOLATION UNIT TESTS");
console.log("=================================================\n");

let passed = 0;
let total = 0;

function test(desc, fn) {
    total++;
    try {
        fn();
        console.log(`✅ [PASS] ${desc}`);
        passed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${desc}`);
        console.error("  Error:", err.message);
    }
}

// Simulated data
const mockChatSessions = [
    { id: 1, title: "Sabah Kahvaltısı Önerileri", updated_at: 1700000000 },
    { id: 2, title: "Çıtır Patates Tarifi", updated_at: 1700001000 },
    { id: 3, title: "Tavuk Göğsü Kalori ve Protein", updated_at: 1700002000 }
];

const mockSavedWidgets = [
    {
        id: 101,
        type: "recipe",
        title: "Kıtır ARFID Tostu",
        data: { prep_time_min: 10, dietitian_note: "Ekmek kıtır olmalı" }
    },
    {
        id: 102,
        type: "nutrition",
        title: "Haşlanmış Yumurta",
        data: { food_name: "Yumurta", total_calories: 78 }
    },
    {
        id: 103,
        type: "recipe",
        title: "Glutensiz ARFID Krepi",
        data: { prep_time_min: 15, dietitian_note: "Pürüzsüz doku" }
    }
];

// Sidebar state controller mimicking frontend logic
class SidebarController {
    constructor() {
        this.activeTab = 'chats'; // 'chats' or 'recipes'
        this.allChatSessions = [...mockChatSessions];
        this.allSavedWidgets = [...mockSavedWidgets];
        this.filteredChats = [...mockChatSessions];
        this.filteredWidgets = [...mockSavedWidgets];
    }

    switchTab(tab) {
        this.activeTab = tab;
    }

    onSearchInput(query) {
        const q = (query || '').toLowerCase().trim();
        if (this.activeTab === 'chats') {
            this.filteredChats = q
                ? this.allChatSessions.filter(s => (s.title || '').toLowerCase().includes(q))
                : this.allChatSessions;
        } else if (this.activeTab === 'recipes') {
            this.filteredWidgets = q
                ? this.allSavedWidgets.filter(w => {
                    const title = (w.title || '').toLowerCase();
                    const type = (w.type || '').toLowerCase();
                    const note = (w.data && (w.data.food_name || w.data.dietitian_note || '')) 
                        ? String(w.data.food_name || w.data.dietitian_note).toLowerCase() 
                        : '';
                    return title.includes(q) || type.includes(q) || note.includes(q);
                })
                : this.allSavedWidgets;
        }
    }
}

// Tests
test("1. When on 'chats' tab, searching filters ONLY chat sessions and leaves saved widgets untouched", () => {
    const ctrl = new SidebarController();
    ctrl.switchTab('chats');
    ctrl.onSearchInput("Kahvaltı");

    assert.strictEqual(ctrl.filteredChats.length, 1);
    assert.strictEqual(ctrl.filteredChats[0].title, "Sabah Kahvaltısı Önerileri");
    // Saved widgets must remain intact
    assert.strictEqual(ctrl.filteredWidgets.length, 3);
});

test("2. When on 'recipes' tab, searching filters ONLY saved widgets and leaves chat sessions untouched", () => {
    const ctrl = new SidebarController();
    ctrl.switchTab('recipes');
    ctrl.onSearchInput("Tost");

    assert.strictEqual(ctrl.filteredWidgets.length, 1);
    assert.strictEqual(ctrl.filteredWidgets[0].title, "Kıtır ARFID Tostu");
    // Chat sessions must remain completely untouched
    assert.strictEqual(ctrl.filteredChats.length, 3);
});

test("3. Searching for a term existing in both datasets only filters the ACTIVE tab", () => {
    const ctrl = new SidebarController();
    // Both datasets have something related to "Tarif" or "Tarifi"
    ctrl.switchTab('chats');
    ctrl.onSearchInput("tarifi");
    assert.strictEqual(ctrl.filteredChats.length, 1);
    assert.strictEqual(ctrl.filteredChats[0].title, "Çıtır Patates Tarifi");
    assert.strictEqual(ctrl.filteredWidgets.length, 3, "Widgets must not have changed when searching chats");

    // Now switch to recipes and search for "Krep"
    ctrl.switchTab('recipes');
    ctrl.onSearchInput("Krep");
    assert.strictEqual(ctrl.filteredWidgets.length, 1);
    assert.strictEqual(ctrl.filteredWidgets[0].title, "Glutensiz ARFID Krepi");
    assert.strictEqual(ctrl.filteredChats.length, 1, "Chats must remain in previous state without being overwritten");
});

test("4. Empty search query restores full list for the active tab", () => {
    const ctrl = new SidebarController();
    ctrl.switchTab('recipes');
    ctrl.onSearchInput("XYZ_NON_EXISTENT");
    assert.strictEqual(ctrl.filteredWidgets.length, 0);

    ctrl.onSearchInput("");
    assert.strictEqual(ctrl.filteredWidgets.length, 3);
});

test("5. Recipe search matches nested fields (e.g. food_name or dietitian_note)", () => {
    const ctrl = new SidebarController();
    ctrl.switchTab('recipes');
    
    // Search by dietitian_note keyword "pürüzsüz"
    ctrl.onSearchInput("pürüzsüz");
    assert.strictEqual(ctrl.filteredWidgets.length, 1);
    assert.strictEqual(ctrl.filteredWidgets[0].title, "Glutensiz ARFID Krepi");

    // Search by food_name "yumurta"
    ctrl.onSearchInput("yumurta");
    assert.strictEqual(ctrl.filteredWidgets.length, 1);
    assert.strictEqual(ctrl.filteredWidgets[0].title, "Haşlanmış Yumurta");
});

console.log(`\n=================================================`);
console.log(`📊 RESULTS: ${passed}/${total} tests passed`);
console.log(`=================================================`);

if (passed === total) {
    process.exit(0);
} else {
    process.exit(1);
}
