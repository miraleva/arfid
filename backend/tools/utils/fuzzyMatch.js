/**
 * Fuzzy Matching Utility
 * Shared string normalization and Fuse.js search setup for tools.
 */

const Fuse = require("fuse.js");

/**
 * Normalizes Turkish and English strings for robust matching
 * (lowercases, removes accents/special characters, trims)
 * 
 * @param {string} str - Raw string
 * @returns {string} Normalized string
 */
function normalizeString(str) {
    if (!str || typeof str !== "string") return "";
    return str
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

/**
 * Creates a configured Fuse.js instance with standardized options
 * 
 * @param {Array<Object>} list - Array of objects to index
 * @param {Array<Object|string>} keys - Fuse.js keys configuration
 * @param {Object} [customOptions={}] - Optional overrides
 * @returns {Fuse} Configured Fuse instance
 */
function createFuzzyMatcher(list, keys, customOptions = {}) {
    const defaultOptions = {
        keys: keys,
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
        includeScore: true
    };

    return new Fuse(list, { ...defaultOptions, ...customOptions });
}

module.exports = {
    normalizeString,
    createFuzzyMatcher
};
