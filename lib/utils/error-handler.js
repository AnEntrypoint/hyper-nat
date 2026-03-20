/**
 * Error Handling System
 * Provides structured error types and handling for hyper-nat
 */

// Custom error types
class HyperNatError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'HyperNatError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

class ConnectionError extends HyperNatError {
    constructor(message, details = {}) {
        super(message, 'CONNECTION_ERROR', details);
        this.name = 'ConnectionError';
    }
}

class TimeoutError extends HyperNatError {
    constructor(message, timeout, details = {}) {
        super(message, 'TIMEOUT_ERROR', { timeout, ...details });
        this.name = 'TimeoutError';
    }
}

class ConfigurationError extends HyperNatError {
    constructor(message, details = {}) {
        super(message, 'CONFIGURATION_ERROR', details);
        this.name = 'ConfigurationError';
    }
}

class ProtocolError extends HyperNatError {
    constructor(message, protocol, details = {}) {
        super(message, 'PROTOCOL_ERROR', { protocol, ...details });
        this.name = 'ProtocolError';
    }
}

// Error handler utility
class ErrorHandler {
    static handle(error, context = '') {
        const errorInfo = {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            context,
            timestamp: new Date().toISOString(),
            stack: error.stack
        };

        // Log based on error type
        if (error instanceof TimeoutError) {
            console.warn(`[TIMEOUT] ${context}: ${error.message}`);
        } else if (error instanceof ConnectionError) {
            console.error(`[CONNECTION] ${context}: ${error.message}`);
        } else if (error instanceof ConfigurationError) {
            console.error(`[CONFIG] ${context}: ${error.message}`);
        } else {
            console.error(`[ERROR] ${context}: ${error.message}`);
        }

        return errorInfo;
    }

    static wrap(error, context = '', code = 'UNKNOWN_ERROR') {
        if (error instanceof HyperNatError) {
            return error;
        }

        return new HyperNatError(error.message, code, { originalError: error, context });
    }

    static isRecoverable(error) {
        // Determine if an error is recoverable
        const recoverableCodes = [
            'TIMEOUT_ERROR',
            'CONNECTION_ERROR',
            'NETWORK_ERROR'
        ];

        return recoverableCodes.includes(error.code) || 
               error.message.includes('timeout') ||
               error.message.includes('connection') ||
               error.message.includes('network');
    }

    static createConnectionError(message, socketType = 'unknown', details = {}) {
        return new ConnectionError(message, { socketType, ...details });
    }

    static createTimeoutError(message, timeout, details = {}) {
        return new TimeoutError(message, timeout, details);
    }

    static createConfigurationError(message, parameter, value, details = {}) {
        return new ConfigurationError(message, { parameter, value, ...details });
    }

    static createProtocolError(message, protocol, operation, details = {}) {
        return new ProtocolError(message, protocol, { operation, ...details });
    }
}

module.exports = {
    HyperNatError,
    ConnectionError,
    TimeoutError,
    ConfigurationError,
    ProtocolError,
    ErrorHandler
};
