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
                    console.log('new local connection on port ' + config.localPort + ', relaying to remote tcp ' + port);
                    const socket = node.connect(publicKey, { reusableSocket: true });
                    pump(local, socket, local);
                });
                
                server.listen(config.localPort, "127.0.0.1");
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
                server.bind(config.localPort);
                console.log('UDP stream ready, listening for packets on ', port);
            }
        },
        tcpudp: {
            server: async (keyPair, port, host) => {
                const server = node.createServer();
                server.on("connection", function (conn) {
                    console.log('new connection, relaying to tcp-over-udp ' + port);
                    var socket = net.connect({port, host, allowHalfOpen: false });
                    
                    // Wait for socket connection before setting up data flow
                    socket.on('connect', () => {
                        console.log('connected to local service');
                        
                        // TCP to UDP transport: read from TCP socket and send via UDP rawStream
                        socket.on('data', (data) => {
                            try {
                                if (conn && !conn.destroyed) {
                                    conn.rawStream.send(data);
                                }
                            } catch (err) {
                                console.log('error sending data to remote:', err.message);
                                socket.destroy();
                            }
                        });
                        
                        // UDP transport to TCP: receive from UDP rawStream and write to TCP socket
                        conn.rawStream.on('message', function (data) {
                            try {
                                if (socket && !socket.destroyed) {
                                    socket.write(data);
                                }
                            } catch (err) {
                                console.log('error writing data to local socket:', err.message);
                                conn.destroy();
                            }
                        });
                    });
                    
                    // Handle TCP socket events
                    socket.on('close', () => {
                        console.log('local tcp connection closed');
                        if (conn && !conn.destroyed) {
                            conn.destroy();
                        }
                    });
                    
                    socket.on('end', () => {
                        console.log('local tcp connection ended');
                        if (conn && !conn.destroyed) {
                            conn.destroy();
                        }
                    });
                    
                    socket.on('error', (err) => {
                        console.log('local tcp socket error:', err.message);
                        if (conn && !conn.destroyed) {
                            conn.destroy();
                        }
                    });
                    
                    // Handle UDP connection events
                    conn.on('close', () => {
                        console.log('remote udp connection closed');
                        if (socket && !socket.destroyed) {
                            socket.destroy();
                        }
                    });
                    
                    conn.on('error', (err) => {
                        console.log('remote udp connection error:', err.message);
                        if (socket && !socket.destroyed) {
                            socket.destroy();
                        }
                    });
                });
                console.log('listening for remote connections for tcp-over-udp', port);
                await server.listen(keyPair);
            },
            client: async (publicKey, port) => {
                console.log('connecting to tcp-over-udp', port);
                
                // Test the connection first to ensure it's ready
                const testConn = await node.connect(publicKey);
                await new Promise(res => testConn.on('open', res));
                testConn.destroy();
                console.log('connection ready');
                
                var server = net.createServer({allowHalfOpen: false}, async function (localSocket) {
                    console.log('new local tcp connection, relaying to remote tcp-over-udp', port);
                    
                    try {
                        const conn = node.connect(publicKey);
                        
                        // Wait for connection to be ready before setting up data flow
                        await new Promise((resolve, reject) => {
                            conn.on('open', resolve);
                            conn.on('error', reject);
                            setTimeout(() => reject(new Error('Connection timeout')), 10000);
                        });
                        
                        // TCP to UDP transport: read from local TCP socket and send via UDP rawStream
                        localSocket.on('data', (data) => {
                            try {
                                conn.rawStream.send(data);
                            } catch (err) {
                                console.log('error sending data to remote:', err.message);
                                localSocket.destroy();
                            }
                        });
                        
                        // UDP transport to TCP: receive from UDP rawStream and write to local TCP socket
                        conn.rawStream.on('message', function (data) {
                            try {
                                if (!localSocket.destroyed) {
                                    localSocket.write(data);
                                }
                            } catch (err) {
                                console.log('error writing data to local socket:', err.message);
                                conn.destroy();
                            }
                        });
                        
                        // Handle local TCP socket events
                        localSocket.on('close', () => {
                            console.log('local tcp connection closed');
                            conn.destroy();
                        });
                        
                        localSocket.on('end', () => {
                            console.log('local tcp connection ended');
                            conn.destroy();
                        });
                        
                        localSocket.on('error', (err) => {
                            console.log('local tcp socket error:', err.message);
                            conn.destroy();
                        });
                        
                        // Handle remote UDP connection events
                        conn.on('close', () => {
                            console.log('remote udp connection closed');
                            if (!localSocket.destroyed) {
                                localSocket.destroy();
                            }
                        });
                        
                        conn.on('error', (err) => {
                            console.log('remote udp connection error:', err.message);
                            if (!localSocket.destroyed) {
                                localSocket.destroy();
                            }
                        });
                        
                    } catch (err) {
                        console.log('failed to connect to remote:', err.message);
                        localSocket.destroy();
                    }
                });
                
                server.listen(port, "127.0.0.1");
                console.log('TCP-over-UDP stream ready, listening for connections on', port);
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
        if (!['tcp', 'udp', 'tcpudp'].includes(p)) {
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
        const localPorts = parsePortList(argv['local-port']);
        const remotePorts = parsePortList(argv['remote-port']);
        const protocols = parseProtocolList(argv.protocol, localPorts.length);
        
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
        const configurations = localPorts.map((localPort, index) => ({
            mode: 'client',
            proto: protocols[index],
            port: remotePorts[index],
            localPort: localPort,
            publicKey: argv.publicKey || argv['public-key']
        }));
        
        await runFromConfig(configurations);
    }
};

main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
