const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const ConfigManager = require('./config');

/**
 * CLI interface and command handling for hyper-nat
 */
class CLI {
    /**
     * Create and configure the CLI interface
     * @returns {Object} Configured yargs instance
     */
    static createCLI() {
        return yargs(hideBin(process.argv))
            .scriptName('hyper-nat')
            .usage('$0 <command> [options]')
            .command('server', 'Run as server mode', (yargs) => {
                return yargs
                    .option('port', {
                        alias: 'p',
                        type: 'string',
                        demandOption: true,
                        description: 'Port(s) to forward (comma-separated for multiple: 3000,3001,3002)'
                    })
                    .option('host', {
                        type: 'string',
                        default: '127.0.0.1',
                        description: 'Host to forward to'
                    })
                    .option('protocol', {
                        alias: 'proto',
                        type: 'string',
                        default: 'udp',
                        description: 'Protocol(s) to use: tcp, udp, or tcpudp (comma-separated for multiple: tcp,udp,tcpudp)'
                    })
                    .option('secret', {
                        alias: 's',
                        type: 'string',
                        description: 'Secret key for authentication (auto-generated if not provided)'
                    });
            })
            .command('client', 'Run as client mode', (yargs) => {
                return yargs
                    .option('local-port', {
                        alias: 'l',
                        type: 'string',
                        demandOption: true,
                        description: 'Local port(s) to bind (comma-separated for multiple: 3000,3001,3002)'
                    })
                    .option('remote-port', {
                        alias: 'r',
                        type: 'string',
                        demandOption: true,
                        description: 'Remote port(s) to connect to (comma-separated for multiple: 80,8080,443)'
                    })
                    .option('protocol', {
                        alias: 'proto',
                        type: 'string',
                        default: 'udp',
                        description: 'Protocol(s) to use: tcp, udp, or tcpudp (comma-separated for multiple: tcp,udp,tcpudp)'
                    })
                    .option('public-key', {
                        alias: 'k',
                        type: 'string',
                        demandOption: true,
                        description: 'Public key from server'
                    });
            })
            .option('config', {
                alias: 'c',
                type: 'string',
                description: 'Configuration file path (default: options.json)'
            })
            .help('h')
            .alias('h', 'help')
            .example('$0 server -p 3000 -s mysecret', 'Run server on single port 3000')
            .example('$0 server -p 3000 --protocol tcpudp -s mysecret', 'Run server with TCP-over-UDP on port 3000')
            .example('$0 server -p 3000,3001,3002 --protocol udp,tcp,tcpudp -s mysecret', 'Run server on multiple ports with different protocols')
            .example('$0 client -l 8080 -r 80 -k <publickey>', 'Connect local port 8080 to remote port 80')
            .example('$0 client -l 8080 -r 80 --protocol tcpudp -k <publickey>', 'Connect using TCP-over-UDP from local 8080 to remote 80')
            .example('$0 client -l 8080,8081 -r 80,443 --protocol udp,tcpudp -k <publickey>', 'Connect multiple ports with different protocols')
            .example('$0 -c myconfig.json', 'Use configuration file')
            .demandCommand(0, 1, 'You can specify a command, use config file, or run without arguments for default server mode')
            .argv;
    }

    /**
     * Handle server command
     * @param {Object} argv - Parsed command line arguments
     */
    static async handleServerCommand(argv) {
        const ports = ConfigManager.parsePortList(argv.port);
        const protocols = ConfigManager.parseProtocolList(argv.protocol, ports.length);
        
        if (ports.length === 0) {
            console.error('Error: No valid ports specified');
            process.exit(1);
        }
        
        if (protocols.length !== ports.length) {
            console.error(`Error: Number of protocols (${protocols.length}) must match number of ports (${ports.length})`);
            process.exit(1);
        }
        
        // Generate secret if not provided
        const secret = argv.secret || ConfigManager.generateRandomSecret();
        if (!argv.secret) {
            console.log(`Generated random secret: ${secret}\n`);
        }
        
        console.log(`Starting server mode with ${ports.length} port(s)`);
        
        // Create multiple configurations and run them
        const configurations = ports.map((port, index) => ({
            mode: 'server',
            proto: protocols[index],
            port: port,
            host: argv.host,
            secret: secret,
            showCommands: true
        }));
        
        await ConfigManager.runFromConfig(configurations, true);
    }

    /**
     * Handle client command
     * @param {Object} argv - Parsed command line arguments
     */
    static async handleClientCommand(argv) {
        const localPorts = ConfigManager.parsePortList(argv['local-port']);
        const remotePorts = ConfigManager.parsePortList(argv['remote-port']);
        const protocols = ConfigManager.parseProtocolList(argv.protocol, localPorts.length);
        
        if (localPorts.length === 0 || remotePorts.length === 0) {
            console.error('Error: No valid ports specified');
            process.exit(1);
        }
        
        if (localPorts.length !== remotePorts.length) {
            console.error(`Error: Number of local ports (${localPorts.length}) must match number of remote ports (${remotePorts.length})`);
            process.exit(1);
        }
        
        if (protocols.length !== localPorts.length) {
            console.error(`Error: Number of protocols (${protocols.length}) must match number of ports (${localPorts.length})`);
            process.exit(1);
        }
        
        console.log(`Starting client mode with ${localPorts.length} port mappings`);
        
        // Create multiple configurations and run them
        const publicKey = argv.publicKey || argv['public-key'];
        const configurations = localPorts.map((localPort, index) => ({
            mode: 'client',
            proto: protocols[index],
            port: remotePorts[index],
            localPort: localPort,
            publicKey: publicKey
        }));

        await ConfigManager.runFromConfig(configurations);
    }

    /**
     * Handle default mode (no command specified)
     * @param {Object} argv - Parsed command line arguments
     */
    static async handleDefaultMode(argv) {
        const configPath = argv.config || 'options.json';
        const config = ConfigManager.loadConfig(configPath);
        
        if (config && config.schema) {
            // Check if config contains multiple server configurations with same secret
            const serverConfigs = config.schema.filter(c => c.mode === 'server');
            const hasMultipleServersWithSameSecret = serverConfigs.length > 1 && 
                serverConfigs.every(c => c.secret === serverConfigs[0].secret);
            
            await ConfigManager.runFromConfig(config.schema, hasMultipleServersWithSameSecret);
            return;
        }
        
        // Default behavior: Start server mode with both UDP and TCP on localhost:3000
        console.log('No command specified - starting default server mode...');
        console.log('Server will run on localhost:3000 with both UDP and TCP protocols');
        console.log('Use --help to see all available options\n');
        
        const defaultSecret = ConfigManager.generateRandomSecret();
        console.log(`Generated random secret: ${defaultSecret}\n`);
        
        const defaultConfigurations = ConfigManager.createDefaultConfigurations(defaultSecret);
        
        console.log('Starting servers...');
        await ConfigManager.runFromConfig(defaultConfigurations, true);
    }

    /**
     * Main CLI entry point
     */
    static async main() {
        const argv = CLI.createCLI();
        const command = argv._[0];
        
        try {
            if (!command) {
                await CLI.handleDefaultMode(argv);
            } else if (command === 'server') {
                await CLI.handleServerCommand(argv);
            } else if (command === 'client') {
                await CLI.handleClientCommand(argv);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
}

module.exports = CLI;