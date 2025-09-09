const Keychain = require('keypear');
const DHT = require("@hyperswarm/dht");
const bs58 = require('bs58').default;
const { createRelay } = require('./dht-relay');

/**
 * Mode handlers for client and server operations
 */
class ModeHandler {
    /**
     * Handle client mode operations
     * @param {Object} settings - Client settings
     * @param {string} settings.proto - Protocol (tcp/udp/tcpudp)
     * @param {number} settings.port - Remote port
     * @param {string} settings.publicKey - Base58 encoded public key
     * @param {number} settings.localPort - Local port to bind
     */
    static async client(settings) {
        const { proto, port, publicKey, localPort } = settings;
        const keys = new Keychain(bs58.decode(publicKey));
        const key = keys.get(proto + port).publicKey;
        const rel = await createRelay();
        return (rel)[proto].client(key, port, { localPort });
    }

    /**
     * Handle server mode operations
     * @param {Object} settings - Server settings
     * @param {string} settings.proto - Protocol (tcp/udp/tcpudp)
     * @param {number} settings.port - Port to expose
     * @param {string} settings.host - Host to forward to (default: 127.0.0.1)
     * @param {string} settings.secret - Secret for key derivation
     * @param {boolean} settings.showCommands - Whether to show connection commands
     * @returns {Promise<string>} Base58 encoded public key for client connections
     */
    static async server(settings) {
        const { proto, port, host, secret, showCommands = false } = settings;
        const hash = DHT.hash(Buffer.from(secret));
        const kp = DHT.keyPair(hash);
        const publicKey = bs58.encode(kp.publicKey);
        
        if (showCommands) {
            console.log(`\n=== CLIENT CONNECTION COMMAND FOR ${proto.toUpperCase()}:${port} ===`);
            console.log(`npx hyper-nat client -p ${port} --protocol ${proto} -k ${publicKey}`);
            console.log(`=== END COMMAND ===\n`);
        }
        
        const rel = await createRelay();
        const keys = new Keychain(kp);
        const keyPair = keys.get(proto + port);
        (rel)[proto].server(keyPair, port, host);
        
        return publicKey;
    }
}

module.exports = ModeHandler;