/**
 * @file types.js
 * Central JSDoc Type Definitions for ARFID Backend
 * Provides IDE autocompletion and type documentation without requiring TypeScript.
 */

/**
 * @typedef {Object} User
 * @property {number} id - Unique user identifier
 * @property {string} email - User email address
 * @property {string} username - Display username
 */

/**
 * @typedef {Object} ChatMessage
 * @property {number} [id] - Database message ID
 * @property {number} [user_id] - User ID owning this message
 * @property {'user' | 'assistant'} role - Message sender role
 * @property {string} content - Message text content
 * @property {number} [created_at] - Unix epoch timestamp (seconds)
 */

/**
 * @typedef {Object} FoodUpdate
 * @property {string} name - Food item name (matched to master list or user term)
 * @property {number} is_safe - 1 if safe to consume, 0 if problematic/unsafe
 */

/**
 * @typedef {Object} SensoryUpdate
 * @property {string} name - Sensory attribute (e.g., 'mushy texture')
 * @property {number} is_problematic - 1 if trigger/problematic
 */

/**
 * @typedef {Object} ConditionUpdate
 * @property {string} name - Condition name (e.g., 'anxiety')
 * @property {number} has_condition - 1 if diagnosed/present
 */

/**
 * @typedef {Object} MemoryUpdates
 * @property {FoodUpdate[]} foods - Extracted food preferences
 * @property {SensoryUpdate[]} sensory - Extracted sensory triggers
 * @property {ConditionUpdate[]} conditions - Extracted conditions
 */

/**
 * @typedef {Object} MasterLists
 * @property {string[]} foods - Master list of known food names
 * @property {string[]} sensory - Master list of known sensory attributes
 * @property {string[]} conditions - Master list of known conditions
 */

/**
 * @typedef {Object} RagChunk
 * @property {string} text - Chunk text content
 * @property {string} source - Source book/document name
 * @property {number|null} [page_number] - Original page number in source
 * @property {number} [score] - Pinecone vector similarity score
 */

/**
 * @typedef {Object} DietitianResult
 * @property {string} assistant_response - Final visible dietitian response
 * @property {string} patient_card - Quick-view patient summary card
 */

/**
 * @typedef {Object} PromptBuilderParams
 * @property {string} userText - Current user message
 * @property {MasterLists} masterLists - Database master lists for semantic mapping
 * @property {string} memoryContext - Formatted user constraints string
 * @property {string} ragContext - Formatted recipe/knowledge chunks string
 * @property {string} recentChatContext - Formatted recent conversation history
 */

module.exports = {};
