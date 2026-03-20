/**
 * Configuration Utility
 * Centralizes configuration values and provides validation
 */
class Config {
    constructor() {
        // Default configuration values
        this.defaults = {
            network: {
                timeout: 15000,           // 15 seconds
                host: '127.0.0.1',
                allowHalfOpen: false,
                reusableSocket: true
            },
            protocols: {
                tcp: { port: 3000 },
                udp: { port: 3001 },
                tcpudp: { port: 3002 }
            },
            logging: {
                level: 'info',
                cleanupInterval: 10000,   // 10 seconds
                connectionTimeout: 30000  // 30 seconds
            }
        };
    }

    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let value = this.defaults;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.defaults;
        
        for (const key of keys) {
            if (!(key in target) || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        target[lastKey] = value;
    }

    merge(customConfig) {
        this.deepMerge(this.defaults, customConfig);
    }

    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!(key in target) || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    validatePort(port) {
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            throw new Error(`Invalid port: ${port}. Must be between 1 and 65535.`);
        }
        return portNum;
    }

    validateHost(host) {
        if (!host || typeof host !== 'string') {
            throw new Error('Invalid host: must be a non-empty string');
        }
        return host;
    }

    validateTimeout(timeout) {
        const timeoutNum = parseInt(timeout);
        if (isNaN(timeoutNum) || timeoutNum < 1000) {
            throw new Error('Invalid timeout: must be at least 1000ms');
        }
        return timeoutNum;
    }

    createConnectionConfig(options = {}) {
        return {
            host: this.validateHost(options.host || this.get('network.host')),
            timeout: this.validateTimeout(options.timeout || this.get('network.timeout')),
            allowHalfOpen: options.allowHalfOpen ?? this.get('network.allowHalfOpen')
        };
    }

    createServerConfig(options = {}) {
        return {
            reusableSocket: options.reusableSocket ?? this.get('network.reusableSocket')
        };
    }
}

// Create default configuration instance
const config = new Config();

module.exports = { Config, config };
