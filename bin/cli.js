#!/usr/bin/env node

/**
 * CLI entry point for hyper-nat
 * This file handles command-line execution only.
 * For library usage, import from index.js instead.
 */

const CLI = require('../lib/cli');

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
