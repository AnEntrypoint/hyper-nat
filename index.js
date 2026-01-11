/**
 * Hyper-NAT - A modern NAT traversal solution using hyperswarm DHT
 *
 * Library exports for peer-to-peer NAT traversal and tunneling.
 * For CLI usage, see bin/cli.js
 *
 * Features:
 * - TCP, UDP, and TCP-over-UDP protocol support
 * - Multi-port configurations with different protocols per port
 * - Configuration file support for complex setups
 * - Connection timeout and error handling (10-15 seconds)
 * - HTTP-friendly TCP forwarding with proper connection lifecycle
 *
 * @example
 * const { DHTRelay, ConfigManager, ModeHandler } = require('hyper-nat');
 *
 * const config = ConfigManager.loadConfig('./config.json');
 * const relay = new DHTRelay();
 * const relayServer = await relay.createRelay(config);
 */

const { DHTRelay, createRelay } = require('./lib/dht-relay');
const ConfigManager = require('./lib/config');
const ModeHandler = require('./lib/modes');

module.exports = {
    DHTRelay,
    createRelay,
    ConfigManager,
    ModeHandler
};