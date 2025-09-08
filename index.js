#!/usr/bin/env node
const Keychain = require('keypear');
const DHT = require("@hyperswarm/dht");
const pump = require("pump");
var net = require("net");
const udp = require('dgram');
const fs = require('fs');
const crypto = require('crypto');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const bs58 = require('bs58').default
const relay = async () => {
    const node = new DHT({});
    await node.ready();
    return {
        tcp: {
            server: async (keyPair, port, host) => {
                const server = node.createServer({ reusableSocket: true });
                server.on("connection", function (servsock) {
                    console.log('new connection, relaying to ' + port);
                    var socket = net.connect({port, host, allowHalfOpen: true });
                    pump(servsock, socket, servsock);
                });

                console.log('listening for remote connections for tcp', port);
                server.listen(keyPair);
            },
            client: async (publicKey, port) => {
                console.log('connecting to tcp', port);
                
                // Test the connection first to ensure it's ready
                const testSocket = node.connect(publicKey, { reusableSocket: true });
                await new Promise((resolve, reject) => {
                    testSocket.on('open', () => {
                        testSocket.destroy();
                        resolve();
                    });
                    testSocket.on('error', reject);
                });
                console.log('connection ready');
                
                var server = net.createServer({allowHalfOpen: true}, function (local) {
                    console.log('new local connection, relaying to remote tcp', port);
                    const socket = node.connect(publicKey, { reusableSocket: true });
                    pump(local, socket, local);
                });
                
                server.listen(port, "127.0.0.1");
                console.log('TCP stream ready, listening for connections on', port);
            }
        },
        udp: {
            server: async (keyPair, port, host) => {
                const server = node.createServer();
                server.on("connection", function (conn) {
                    console.log('new connection, relaying to ' + port);
                    var client = udp.createSocket('udp4');
                    client.connect(port, host);
                    client.on('message', (buf) => {
                        conn.rawStream.send(buf);
                    })
                    conn.rawStream.on('message', function (buf) {
                        client.send(buf);
                    })
                });
                console.log('listening for remote connections for udp', port);
                await server.listen(keyPair);
            },
            client: async (publicKey, port) => {
                console.log('connecting to udp', port);
                const conn = await node.connect(publicKey);
                await new Promise(res => conn.on('open', res));
                console.log('connection open');
                var server = udp.createSocket('udp4');
                let inport;
                server.on('message', async (buf, rinfo) => {
                    if (!inport) {
                        console.log('setting port', rinfo);
                        inport = rinfo.port;
                    }
                    conn.rawStream.send(buf);
                })
                conn.rawStream.on('message', (buf) => {
                    server.send(buf, inport);
                })
                server.bind(port);
                console.log('UDP stream ready, listening for packets on ', port);
            }
        }
    }
}

const modes = {
    client: async (settings) => {
        const {proto, port, publicKey} = settings;
        const keys = new Keychain(bs58.decode(publicKey));
        const key = keys.get(proto+port).publicKey;
        const rel = await relay();
        return (rel)[proto].client(key, port);
    },
    server: async (settings) => {
        const {proto, port, host, secret, showCommands = false} = settings;
        const hash = DHT.hash(Buffer.from(secret));
        const kp = DHT.keyPair(hash);
        const publicKey = bs58.encode(kp.publicKey);
        
        if (showCommands) {
            console.log(`\n=== CLIENT CONNECTION COMMAND FOR ${proto.toUpperCase()}:${port} ===`);
            console.log(`npx hyper-nat client -p ${port} --protocol ${proto} -k ${publicKey}`);
            console.log(`=== END COMMAND ===\n`);
	} 
        
        const rel = await relay();
        const keys = new Keychain(kp);
        const keyPair = keys.get(proto + port);
        (rel)[proto].server(keyPair, port, host);
        
        return publicKey;
    }
}

const loadConfig = (configPath) => {
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

const runFromConfig = async (schema, showConsolidatedCommand = false) => {
    console.log('starting up from config');
    const publicKeys = [];
    
    // If showing consolidated command for server mode, collect all server configs first
    if (showConsolidatedCommand) {
        const serverConfigs = schema.filter(config => config.mode === 'server');
        if (serverConfigs.length > 0) {
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
            console.log(`npx hyper-nat client -p ${ports.join(',')} --protocol ${protocols.join(',')} -k ${publicKey}`);
            console.log(`=== END COMMAND ===\n`);
        }
    }
    
    // Start all servers concurrently
    const promises = schema.map(async (forwarder) => {
        // For server mode with consolidated commands, don't show individual commands
        const configWithCommandFlag = showConsolidatedCommand && forwarder.mode === 'server' 
            ? {...forwarder, showCommands: false} 
            : forwarder;
        
        const result = await modes[configWithCommandFlag.mode](configWithCommandFlag);
        if (result && forwarder.mode === 'server') {
            publicKeys.push({proto: forwarder.proto, port: forwarder.port, publicKey: result});
        }
        return result;
    });
    
    // Wait for all to complete (in case of client mode) or start (in case of server mode)
    await Promise.all(promises);
    return publicKeys;
}

// Utility functions for multi-port support
const parsePortList = (portArg) => {
    if (typeof portArg === 'number') {
        return [portArg]; // Single port
    }
    if (typeof portArg === 'string') {
        return portArg.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
    }
    if (Array.isArray(portArg)) {
        return portArg.map(p => parseInt(p, 10)).filter(p => !isNaN(p));
    }
    return [];
}

const parseProtocolList = (protocolArg, portCount) => {
    let protocols = [];
    
    if (typeof protocolArg === 'string') {
        if (protocolArg.includes(',')) {
            protocols = protocolArg.split(',').map(p => p.trim());
        } else {
            protocols = [protocolArg];
        }
    } else if (Array.isArray(protocolArg)) {
        protocols = protocolArg;
    } else {
        protocols = ['udp']; // Default
    }
    
    // If only one protocol specified but multiple ports, replicate the protocol
    if (protocols.length === 1 && portCount > 1) {
        protocols = Array(portCount).fill(protocols[0]);
    }
    
    // Validate protocols
    protocols = protocols.map(p => {
        if (!['tcp', 'udp'].includes(p)) {
            console.warn(`Invalid protocol '${p}', defaulting to 'udp'`);
            return 'udp';
        }
        return p;
    });
    
    return protocols;
}

// CLI Definition
const argv = yargs(hideBin(process.argv))
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
                description: 'Protocol(s) to use (comma-separated for multiple: tcp,udp,tcp)'
            })
            .option('secret', {
                alias: 's',
                type: 'string',
                description: 'Secret key for authentication (auto-generated if not provided)'
            });
    })
    .command('client', 'Run as client mode', (yargs) => {
        return yargs
            .option('port', {
                alias: 'p',
                type: 'string',
                demandOption: true,
                description: 'Local port(s) to bind (comma-separated for multiple: 3000,3001,3002)'
            })
            .option('protocol', {
                alias: 'proto',
                type: 'string',
                default: 'udp',
                description: 'Protocol(s) to use (comma-separated for multiple: tcp,udp,tcp)'
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
    .example('$0 server -p 3000,3001,3002 --protocol udp,tcp,udp -s mysecret', 'Run server on multiple ports')
    .example('$0 client -p 3000 -k <publickey>', 'Connect to server on single port 3000')
    .example('$0 client -p 3000,3001 --protocol udp,tcp -k <publickey>', 'Connect to server on multiple ports')
    .example('$0 -c myconfig.json', 'Use configuration file')
    .demandCommand(0, 1, 'You can specify a command, use config file, or run without arguments for default server mode')
    .argv;

// Generate a random secret key
const generateRandomSecret = () => {
    return crypto.randomBytes(32).toString('hex');
};

const main = async () => {
    const command = argv._[0];
    
    // If no command specified, check for config file first, then default to server mode
    if (!command) {
        const configPath = argv.config || 'options.json';
        const config = loadConfig(configPath);
        
        if (config && config.schema) {
            // Check if config contains multiple server configurations with same secret
            const serverConfigs = config.schema.filter(c => c.mode === 'server');
            const hasMultipleServersWithSameSecret = serverConfigs.length > 1 && 
                serverConfigs.every(c => c.secret === serverConfigs[0].secret);
            
            await runFromConfig(config.schema, hasMultipleServersWithSameSecret);
            return;
        }
        
        // Default behavior: Start server mode with both UDP and TCP on localhost:3000
        console.log('No command specified - starting default server mode...');
        console.log('Server will run on localhost:3000 with both UDP and TCP protocols');
        console.log('Use --help to see all available options\n');
        
        const defaultSecret = generateRandomSecret();
        console.log(`Generated random secret: ${defaultSecret}\n`);
        
        const defaultConfigurations = [
            {
                mode: 'server',
                proto: 'udp',
                port: 3000,
                host: '127.0.0.1',
                secret: defaultSecret,
                showCommands: true
            },
            {
                mode: 'server',
                proto: 'tcp',
                port: 3000,
                host: '127.0.0.1',
                secret: defaultSecret,
                showCommands: true
            }
        ];
        
        console.log('Starting servers...');
        await runFromConfig(defaultConfigurations, true);
        return;
    }

    // Handle CLI commands
    if (command === 'server') {
        const ports = parsePortList(argv.port);
        const protocols = parseProtocolList(argv.protocol, ports.length);
        
        if (ports.length === 0) {
            console.error('Error: No valid ports specified');
            process.exit(1);
        }
        
        if (protocols.length !== ports.length) {
            console.error(`Error: Number of protocols (${protocols.length}) must match number of ports (${ports.length})`);
            process.exit(1);
        }
        
        // Generate secret if not provided
        const secret = argv.secret || generateRandomSecret();
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
        
        await runFromConfig(configurations, true);
        
    } else if (command === 'client') {
        const ports = parsePortList(argv.port);
        const protocols = parseProtocolList(argv.protocol, ports.length);
        
        if (ports.length === 0) {
            console.error('Error: No valid ports specified');
            process.exit(1);
        }
        
        if (protocols.length !== ports.length) {
            console.error(`Error: Number of protocols (${protocols.length}) must match number of ports (${ports.length})`);
            process.exit(1);
        }
        
        console.log(`Starting client mode with ${ports.length} port(s)`);
        
        // Create multiple configurations and run them
        const configurations = ports.map((port, index) => ({
            mode: 'client',
            proto: protocols[index],
            port: port,
            publicKey: argv.publicKey || argv['public-key']
        }));
        
        await runFromConfig(configurations);
    }
};

main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
