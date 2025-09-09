#!/usr/bin/env node

/**
 * Hyper-NAT - A modern NAT traversal solution using hyperswarm DHT
 * 
 * This is the main entry point that delegates to modularized components:
 * - lib/cli.js - Command line interface and argument parsing
 * - lib/config.js - Configuration management and file handling
 * - lib/modes.js - Client/server mode implementations
 * - lib/dht-relay.js - Core DHT relay functionality for TCP/UDP/TCPUDP
 * - lib/key-utils.js - Key generation and cryptographic utilities
 * 
 * Usage:
 *   node index.js server -p 3000 -s mysecret
 *   node index.js client -l 8080 -r 80 -k <publickey>
 *   node index.js -c config.json
 * 
 * Features:
 * - TCP, UDP, and TCP-over-UDP protocol support
 * - Multi-port configurations with different protocols per port
 * - Configuration file support for complex setups
 * - Automatic key generation and management
 * - Connection timeout and error handling (10-15 seconds)
 * - HTTP-friendly TCP forwarding with proper connection lifecycle
 */

const CLI = require('./lib/cli');

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the CLI application
CLI.main();