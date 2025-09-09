const fs = require('fs');
const DHT = require("@hyperswarm/dht");
const bs58 = require('bs58').default;
const crypto = require('crypto');
const ModeHandler = require('./modes');

/**
 * Configuration management utilities for hyper-nat
 */
class ConfigManager {
    /**
     * Load configuration from file
     * @param {string} configPath - Path to configuration file
     * @returns {Object|null} Configuration object or null if not found
     */
    static loadConfig(configPath) {
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (error) {
            console.error(`Error loading config file ${configPath}:`, error.message);
            process.exit(1);
        }
        return null;
    }

    /**
     * Run configuration schema with multiple services
     * @param {Array} schema - Array of service configurations
     * @param {boolean} showConsolidatedCommand - Whether to show consolidated commands for servers
     * @returns {Promise<Array>} Array of public keys for server configurations
     */
    static async runFromConfig(schema, showConsolidatedCommand = false) {
        console.log('starting up from config');
        const publicKeys = [];
        
        // Show consolidated command for server mode if requested
        if (showConsolidatedCommand) {
            const serverConfigs = schema.filter(config => config.mode === 'server');
            if (serverConfigs.length > 0) {
                ConfigManager.showConsolidatedCommand(serverConfigs);
            }
        }
        
        // Start all servers concurrently
        const promises = schema.map(async (forwarder) => {
            // For server mode with consolidated commands, don't show individual commands
            const configWithCommandFlag = showConsolidatedCommand && forwarder.mode === 'server' 
                ? {...forwarder, showCommands: false} 
                : forwarder;

            // Ensure config has all necessary properties for client mode
            if (forwarder.mode === 'client') {
                configWithCommandFlag.localPort = configWithCommandFlag.localPort || forwarder.port;
            }
            
            const result = await ModeHandler[configWithCommandFlag.mode](configWithCommandFlag);
            if (result && forwarder.mode === 'server') {
                publicKeys.push({proto: forwarder.proto, port: forwarder.port, publicKey: result});
            }
            return result;
        });
        
        // Wait for all to complete (client mode) or start (server mode)
        await Promise.all(promises);
        return publicKeys;
    }

    /**
     * Show consolidated connection command for multiple servers
     * @param {Array} serverConfigs - Array of server configurations
     */
    static showConsolidatedCommand(serverConfigs) {
        // Use the first config's publicKey generation logic to get the shared key
        const firstConfig = serverConfigs[0];
        const {secret} = firstConfig;
        const hash = DHT.hash(Buffer.from(secret));
        const kp = DHT.keyPair(hash);
        const publicKey = bs58.encode(kp.publicKey);
        
        // Collect all ports and protocols
        const ports = serverConfigs.map(config => config.port);
        const protocols = serverConfigs.map(config => config.proto);
        
        // Output single consolidated command
        console.log(`\n=== CLIENT CONNECTION COMMAND ===`);
        console.log(`npx hyper-nat client -l ${ports.join(',')} -r ${ports.join(',')} --protocol ${protocols.join(',')} -k ${publicKey}`);
        console.log(`=== END COMMAND ===\n`);
    }

    /**
     * Parse port list from string or array
     * @param {string|number|Array} portArg - Port argument
     * @returns {Array<number>} Array of port numbers
     */
    static parsePortList(portArg) {
        if (typeof portArg === 'number') {
            return [portArg];
        }
        if (typeof portArg === 'string') {
            return portArg.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
        }
        if (Array.isArray(portArg)) {
            return portArg.map(p => parseInt(p, 10)).filter(p => !isNaN(p));
        }
        return [];
    }

    /**
     * Parse protocol list and validate
     * @param {string|Array} protocolArg - Protocol argument
     * @param {number} portCount - Number of ports to match
     * @returns {Array<string>} Array of validated protocol strings
     */
    static parseProtocolList(protocolArg, portCount) {
        let protocols = [];
        
        if (typeof protocolArg === 'string') {
            protocols = protocolArg.replace(/\s+/g, ',').split(',').map(p => p.trim()).filter(p => p);
            if (protocols.length === 0) {
                protocols = ['udp'];
            }
        } else if (Array.isArray(protocolArg)) {
            protocols = protocolArg;
        } else {
            protocols = ['udp'];
        }
        
        // If only one protocol specified but multiple ports, replicate the protocol
        if (protocols.length === 1 && portCount > 1) {
            protocols = Array(portCount).fill(protocols[0]);
        }
        
        // Validate protocols
        protocols = protocols.map(p => {
            if (!['tcp', 'udp', 'tcpudp'].includes(p)) {
                console.warn(`Invalid protocol '${p}', defaulting to 'udp'`);
                return 'udp';
            }
            return p;
        });
        
        return protocols;
    }

    /**
     * Generate a random secret key
     * @param {number} length - Length of secret in bytes (default: 32)
     * @returns {string} Random secret as hex string
     */
    static generateRandomSecret(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Create default server configurations
     * @param {string} secret - Secret key to use
     * @returns {Array} Array of default server configurations
     */
    static createDefaultConfigurations(secret) {
        return [
            {
                mode: 'server',
                proto: 'udp',
                port: 3000,
                host: '127.0.0.1',
                secret: secret,
                showCommands: true
            },
            {
                mode: 'server',
                proto: 'tcp',
                port: 3000,
                host: '127.0.0.1',
                secret: secret,
                showCommands: true
            }
        ];
    }
}

module.exports = ConfigManager;