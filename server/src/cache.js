/**
 * Simple in-memory cache implementation
 * Supports TTL (Time To Live) for automatic expiration
 */

class Cache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} Success status
   */
  set(key, value, ttl = null) {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl: ttl ? ttl * 1000 : null, // Convert to milliseconds
      };

      this.store.set(key, item);

      // Clear existing timer if any
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }

      // Set expiration timer if TTL is provided
      if (ttl && ttl > 0) {
        const timer = setTimeout(() => {
          this.delete(key);
        }, ttl * 1000);
        this.timers.set(key, timer);
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const item = this.store.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (item.ttl) {
      const age = Date.now() - item.timestamp;
      if (age > item.ttl) {
        // Item expired, remove it
        this.delete(key);
        return null;
      }
    }

    return item.value;
  }

  /**
   * Check if a key exists in cache and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is valid
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    // Clear timer if exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    return this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.store.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    let expiredCount = 0;
    const now = Date.now();

    for (const [key, item] of this.store.entries()) {
      if (item.ttl && (now - item.timestamp) > item.ttl) {
        expiredCount++;
      }
    }

    return {
      size: this.store.size,
      expired: expiredCount,
      active: this.store.size - expiredCount,
    };
  }

  /**
   * Clean up expired entries
   * @returns {number} Number of entries removed
   */
  cleanup() {
    let removed = 0;
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, item] of this.store.entries()) {
      if (item.ttl && (now - item.timestamp) > item.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      removed++;
    }

    return removed;
  }

  /**
   * Get all cache keys
   * @returns {string[]} Array of cache keys
   */
  keys() {
    return Array.from(this.store.keys());
  }
}

// Export singleton instance
export const cache = new Cache();

// Auto cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const removed = cache.cleanup();
    if (removed > 0) {
      console.log(`🧹 Cache cleanup: removed ${removed} expired entries`);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

