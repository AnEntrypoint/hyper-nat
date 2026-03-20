const CLI = require('./cli/cli-class');

/**
 * CLI Entry Point
 * Command line interface for hyper-nat
 */

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Export the CLI class and main function
module.exports = CLI;
module.exports.main = async () => {
    const cli = new CLI();
    await cli.main();
};
