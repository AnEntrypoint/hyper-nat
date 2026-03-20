/**
 * Centralized Logging Utility
 * Replaces scattered console.log calls with structured logging
 */
class Logger {
    constructor(level = 'info') {
        this.level = level;
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    error(message, ...args) {
        if (this.levels.error <= this.levels[this.level]) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }

    warn(message, ...args) {
        if (this.levels.warn <= this.levels[this.level]) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }

    info(message, ...args) {
        if (this.levels.info <= this.levels[this.level]) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }

    debug(message, ...args) {
        if (this.levels.debug <= this.levels[this.level]) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    // Static method for easy access
    static create(level = 'info') {
        return new Logger(level);
    }
}

// Create default logger instance
const logger = Logger.create(process.env.LOG_LEVEL || 'info');

module.exports = { Logger, logger };
