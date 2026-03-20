const yargs = require('yargs');
const ConfigManager = require('../config');
const { createRelay } = require('../dht-relay');

/**
 * CLI Class Module
 * Main command line interface class for hyper-nat
 */
class CLI {
    constructor() {
        this.relay = null;
    }

    async main() {
        const argv = yargs
            .usage('Usage: $0 <command> [options]')
            .command('server', 'Start a relay server', (yargs) => {
                return yargs
                    .option('port', { alias: 'p', type: 'string', demandOption: true, describe: 'Port(s) to listen on' })
                    .option('secret', { alias: 's', type: 'string', describe: 'Secret key for DHT' })
                    .option('proto', { alias: 't', type: 'string', default: 'tcp', describe: 'Protocol(s) - tcp, udp, tcpudp' })
                    .option('host', { alias: 'h', type: 'string', default: '127.0.0.1', describe: 'Target host' });
            })
            .command('client', 'Start a relay client', (yargs) => {
                return yargs
                    .option('local-port', { alias: 'l', type: 'string', demandOption: true, describe: 'Local port(s) to bind' })
                    .option('remote-port', { alias: 'r', type: 'string', demandOption: true, describe: 'Remote port(s) to connect to' })
                    .option('key', { alias: 'k', type: 'string', demandOption: true, describe: 'Public key of server' })
                    .option('proto', { alias: 't', type: 'string', default: 'tcp', describe: 'Protocol(s) - tcp, udp, tcpudp' })
                    .option('host', { alias: 'h', type: 'string', default: '127.0.0.1', describe: 'Local host' });
            })
            .command('config', 'Use configuration file', (yargs) => {
                return yargs
                    .option('config', { alias: 'c', type: 'string', demandOption: true, describe: 'Configuration file path' });
            })
            .demandCommand(1, 'You need to specify a command')
            .help()
            .argv;

        try {
            if (argv._[0] === 'server') {
                await this.handleServerCommand(argv);
            } else if (argv._[0] === 'client') {
                await this.handleClientCommand(argv);
            } else if (argv._[0] === 'config') {
                await this.handleConfigCommand(argv);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }

    async handleServerCommand(argv) {
        const ports = ConfigManager.parsePortList(argv.port);
        const protocols = ConfigManager.parseProtocolList(argv.proto);
        const secret = argv.secret || ConfigManager.generateRandomSecret();
        const keyPair = ConfigManager.generateKeyPair(secret);

        console.log(`Starting server with ports: ${ports.join(', ')}`);
        console.log(`Public key: ${keyPair.publicKey.toString('hex')}`);

        const configurations = ports.map((port, index) => ({
            port,
            protocol: protocols[index] || protocols[0],
            host: argv.host
        }));

        this.relay = await createRelay();
        const relayInstance = await this.relay.createRelay();

        for (const config of configurations) {
            const method = relayInstance[config.protocol].server;
            await method(keyPair, config.port, config.host);
            console.log(`Started ${config.protocol.toUpperCase()} server on port ${config.port}`);
        }

        console.log('All servers started successfully');
    }

    async handleClientCommand(argv) {
        const localPorts = ConfigManager.parsePortList(argv['local-port']);
        const remotePorts = ConfigManager.parsePortList(argv['remote-port']);
        const protocols = ConfigManager.parseProtocolList(argv.proto);
        const publicKey = Buffer.from(argv.key, 'hex');

        console.log(`Connecting to server with local ports: ${localPorts.join(', ')}`);

        this.relay = await createRelay();
        const relayInstance = await this.relay.createRelay();

        for (let i = 0; i < localPorts.length; i++) {
            const config = {
                port: localPorts[i],
                remotePort: remotePorts[i] || remotePorts[0],
                protocol: protocols[i] || protocols[0],
                host: argv.host
            };

            const method = relayInstance[config.protocol].client;
            await method(publicKey, config.port, { host: config.host });
            console.log(`Started ${config.protocol.toUpperCase()} client from port ${config.port}`);
        }

        console.log('All clients connected successfully');
    }

    async handleConfigCommand(argv) {
        const config = ConfigManager.loadConfig(argv.config);
        console.log(`Loading configuration from: ${argv.config}`);

        if (config.server) {
            await this.handleServerConfig(config.server);
        }

        if (config.client) {
            await this.handleClientConfig(config.client);
        }

        console.log('Configuration loaded successfully');
    }

    async handleServerConfig(serverConfig) {
        const keyPair = ConfigManager.generateKeyPair(serverConfig.secret);
        this.relay = await createRelay();
        const relayInstance = await this.relay.createRelay();

        for (const portConfig of serverConfig.ports) {
            const method = relayInstance[portConfig.protocol].server;
            await method(keyPair, portConfig.port, portConfig.host);
            console.log(`Started ${portConfig.protocol.toUpperCase()} server on port ${portConfig.port}`);
        }
    }

    async handleClientConfig(clientConfig) {
        const publicKey = Buffer.from(clientConfig.serverKey, 'hex');
        this.relay = await createRelay();
        const relayInstance = await this.relay.createRelay();

        for (const portConfig of clientConfig.ports) {
            const method = relayInstance[portConfig.protocol].client;
            await method(publicKey, portConfig.localPort, { host: portConfig.host });
            console.log(`Started ${portConfig.protocol.toUpperCase()} client for local port ${portConfig.localPort}`);
        }
    }

    async cleanup() {
        if (this.relay) {
            await this.relay.destroy();
            this.relay = null;
        }
    }
}

module.exports = CLI;
