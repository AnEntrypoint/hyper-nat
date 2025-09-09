const Keychain = require('keypear');
const crypto = require('crypto');
const bs58 = require('bs58').default;

/**
 * Key generation and management utilities for hyper-nat
 */
class KeyUtils {
    /**
     * Generate a new keypair
     * @returns {Object} keypair with publicKey and secretKey
     */
    static generateKeyPair() {
        const keychain = new Keychain();
        return keychain.get();
    }

    /**
     * Derive keypair from secret
     * @param {string} secret - Secret string to derive from
     * @returns {Object} keypair with publicKey and secretKey
     */
    static deriveFromSecret(secret) {
        const keychain = new Keychain();
        return keychain.get(secret);
    }

    /**
     * Convert public key to hex string
     * @param {Buffer} publicKey - Public key buffer
     * @returns {string} hex string
     */
    static toHexString(publicKey) {
        return publicKey.toString('hex');
    }

    /**
     * Convert hex string to buffer
     * @param {string} hexString - Hex string
     * @returns {Buffer} buffer
     */
    static fromHexString(hexString) {
        return Buffer.from(hexString, 'hex');
    }

    /**
     * Encode public key as base58
     * @param {Buffer} publicKey - Public key buffer
     * @returns {string} base58 encoded string
     */
    static toBase58(publicKey) {
        return bs58.encode(publicKey);
    }

    /**
     * Decode base58 string to buffer
     * @param {string} base58String - Base58 encoded string
     * @returns {Buffer} decoded buffer
     */
    static fromBase58(base58String) {
        return bs58.decode(base58String);
    }

    /**
     * Generate a random secret
     * @param {number} length - Length of secret (default: 32)
     * @returns {string} random secret string
     */
    static generateSecret(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
}

module.exports = KeyUtils;