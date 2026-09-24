/**
 * Central Database Module
 * Manages SQLite connection, concurrency settings (WAL mode), schema definitions, seed data, and graceful shutdown.
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "users.db");
const db = new sqlite3.Database(dbPath);

// Initialize PRAGMA settings, tables, indexes, and seed data
db.serialize(() => {
    // 1. Concurrency & Integrity PRAGMA settings
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA journal_mode = WAL;");
    db.run("PRAGMA busy_timeout = 5000;");

    // 2. Core Tables
    // Users
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        username TEXT NOT NULL
    )`);

    // Master: Foods
    db.run(`CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    )`);

    // Master: Sensory Attributes
    db.run(`CREATE TABLE IF NOT EXISTS sensory_attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    )`);

    // Master: Conditions
    db.run(`CREATE TABLE IF NOT EXISTS conditions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    )`);

    // 3. User Mapping Tables
    // User - Food Preferences
    db.run(`CREATE TABLE IF NOT EXISTS user_food_preferences (
        user_id INTEGER NOT NULL,
        food_id INTEGER NOT NULL,
        is_safe INTEGER NOT NULL CHECK (is_safe IN (0, 1)),
        PRIMARY KEY (user_id, food_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
    )`);

    // User - Sensory Triggers
    db.run(`CREATE TABLE IF NOT EXISTS user_sensory_triggers (
        user_id INTEGER NOT NULL,
        attribute_id INTEGER NOT NULL,
        is_problematic INTEGER NOT NULL CHECK (is_problematic IN (0, 1)),
        PRIMARY KEY (user_id, attribute_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (attribute_id) REFERENCES sensory_attributes(id) ON DELETE CASCADE
    )`);

    // User - Conditions
    db.run(`CREATE TABLE IF NOT EXISTS user_conditions (
        user_id INTEGER NOT NULL,
        condition_id INTEGER NOT NULL,
        has_condition INTEGER NOT NULL CHECK (has_condition IN (0, 1)),
        PRIMARY KEY (user_id, condition_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (condition_id) REFERENCES conditions(id) ON DELETE CASCADE
    )`);

    // 4. Conversations Table (Session Management)
    db.run(`CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_pinned INTEGER DEFAULT 0 CHECK(is_pinned IN (0, 1)),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)`);

    // 5. Chat Messages Table & Indexes
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        conversation_id INTEGER,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_id ON chat_messages(conversation_id, id ASC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_id ON chat_messages(user_id, id)`);

    // 6. Saved Widgets Table (Recipes & Nutritional Cards)
    db.run(`CREATE TABLE IF NOT EXISTS saved_widgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        conversation_id INTEGER,
        related_message_id INTEGER,
        widget_type TEXT NOT NULL CHECK(widget_type IN ('recipe', 'nutrition')),
        title TEXT NOT NULL,
        widget_data TEXT NOT NULL,
        is_pinned INTEGER DEFAULT 0 CHECK(is_pinned IN (0, 1)),
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
        FOREIGN KEY (related_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
    )`);

    // Ensure is_pinned column exists for existing installations
    db.run(`ALTER TABLE saved_widgets ADD COLUMN is_pinned INTEGER DEFAULT 0`, () => {});

    db.run(`CREATE INDEX IF NOT EXISTS idx_saved_widgets_user_id ON saved_widgets(user_id, id DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_saved_widgets_user_pinned ON saved_widgets(user_id, is_pinned DESC, id DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_saved_widgets_conv_id ON saved_widgets(conversation_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_saved_widgets_message_id ON saved_widgets(related_message_id)`);

    // 7. Open Food Facts Image Cache
    db.run(`CREATE TABLE IF NOT EXISTS off_image_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_term TEXT NOT NULL UNIQUE COLLATE NOCASE,
        image_url TEXT,
        product_name TEXT,
        source_url TEXT,
        source_domain TEXT,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    )`);
    db.run(`ALTER TABLE off_image_cache ADD COLUMN source_domain TEXT`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_off_cache_query ON off_image_cache(query_term)`);

    // 6. Seed Data (Idempotent: INSERT OR IGNORE)
    // Foods
    const foods = [
        'Apple', 'Banana', 'Orange', 'Strawberry', 'Grapes',
        'Chicken', 'Beef', 'Pork', 'Turkey', 'Lamb',
        'Rice', 'Pasta', 'Bread', 'Toast', 'Cereal',
        'Potato', 'French Fries', 'Mashed Potatoes', 'Sweet Potato',
        'Carrot', 'Broccoli', 'Cucumber', 'Tomato', 'Lettuce',
        'Milk', 'Cheese', 'Yogurt', 'Ice Cream', 'Butter',
        'Egg', 'Scrambled Eggs', 'Boiled Eggs',
        'Pizza', 'Burger', 'Sandwich', 'Soup',
        'Chocolate', 'Chips', 'Crackers', 'Popcorn', 'Cookie',
        'Water', 'Juice', 'Soda', 'Tea', 'Coffee',
        'Peanut Butter', 'Jam', 'Honey', 'Nuts', 'Fish'
    ];
    const insertFood = db.prepare("INSERT OR IGNORE INTO foods (name) VALUES (?)");
    foods.forEach(food => insertFood.run(food));
    insertFood.finalize();

    // Sensory Attributes
    const sensoryAttributes = [
        'Crunchy Texture', 'Slimy Texture', 'Mushy Texture', 'Chewy Texture',
        'Strong Smell', 'Lack of Smell',
        'Bright Colors', 'Mixed Textures', 'Lumpy',
        'Hot Temperature', 'Cold Temperature',
        'Spicy Taste', 'Bitter Taste', 'Sour Taste', 'Bland Taste'
    ];
    const insertSensory = db.prepare("INSERT OR IGNORE INTO sensory_attributes (name) VALUES (?)");
    sensoryAttributes.forEach(attr => insertSensory.run(attr));
    insertSensory.finalize();

    // Conditions
    const conditions = [
        'Anxiety', 'Depression', 'OCD',
        'Autism / ASD', 'ADHD',
        'Sensory Processing Disorder',
        'Emetophobia', 'Choking Phobia',
        'Lactose Intolerance', 'Gluten Sensitivity',
        'Acid Reflux',
        'Iron Deficiency', 'Vitamin D Deficiency',
        'Social Anxiety', 'General Fatigue'
    ];
    const insertCondition = db.prepare("INSERT OR IGNORE INTO conditions (name) VALUES (?)");
    conditions.forEach(cond => insertCondition.run(cond));
    insertCondition.finalize();

    console.log("Database initialized with V1 schema and seed data.");
});

/**
 * Gracefully closes the active SQLite database connection.
 * 
 * @returns {void}
 */
function closeDb() {
    try {
        db.close((err) => {
            if (err && !err.message.includes("Database is closed")) {
                console.error("[DB] Veritabanı kapatma hatası:", err.message);
            } else {
                console.log("[DB] Veritabanı bağlantısı güvenle kapatıldı.");
            }
        });
    } catch (e) {
        // Ignore if already closed
    }
}

// Graceful shutdown listeners
process.on("SIGINT", () => {
    closeDb();
    process.exit(0);
});
process.on("SIGTERM", () => {
    closeDb();
    process.exit(0);
});

module.exports = db;
