const DHT = require("@hyperswarm/dht");
const pump = require("pump");
const net = require("net");
const udp = require('dgram');

/**
 * DHT Relay functionality for hyper-nat
 * Handles TCP, UDP, and TCP-over-UDP protocols
 */
class DHTRelay {
    constructor() {
        this.node = null;
    }

    async initialize() {
        if (!this.node) {
            this.node = new DHT();
            await this.node.ready();
        }
        return this;
    }

    async createRelay() {
        await this.initialize();
        
        return {
            tcp: {
                server: this.createTcpServer.bind(this),
                client: this.createTcpClient.bind(this)
            },
            udp: {
                server: this.createUdpServer.bind(this),
                client: this.createUdpClient.bind(this)
            },
            tcpudp: {
                server: this.createTcpUdpServer.bind(this),
                client: this.createTcpUdpClient.bind(this)
            }
        };
    }

    async createTcpServer(keyPair, port, host) {
        const server = this.node.createServer({ reusableSocket: true });
        server.on("connection", (servsock) => {
            console.log('new connection, relaying to ' + port);
            const socket = net.connect({
                port, 
                host, 
                allowHalfOpen: false,
                timeout: 15000
            });

            let destroyed = false;
            const cleanup = () => {
                if (!destroyed) {
                    destroyed = true;
                    socket.end();
                    servsock.end();
                }
            };

            socket.on('timeout', () => {
                console.log('Local connection timeout');
                cleanup();
            });

            socket.on('error', (err) => {
                console.log('Local connection error:', err.message);
                cleanup();
            });

            servsock.on('error', (err) => {
                console.log('Remote connection error:', err.message);
                cleanup();
            });

            socket.on('end', () => {
                console.log('Local connection ended naturally');
                servsock.end();
            });

            servsock.on('end', () => {
                console.log('Remote connection ended naturally');
                socket.end();
            });

            pump(servsock, socket, servsock, (err) => {
                if (err) {
                    console.log('Pump error:', err.message);
                }
                cleanup();
            });
        });

        console.log('listening for remote connections for tcp', port);
        server.listen(keyPair);
    }

    async createTcpClient(publicKey, port, config) {
        console.log('connecting to tcp', port);
        
        // Test connection with retries
        let attempts = 3;
        let lastError;
        
        while (attempts > 0) {
            try {
                const testSocket = this.node.connect(publicKey, { reusableSocket: true });
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        testSocket.destroy();
                        reject(new Error('Connection timeout after 15 seconds'));
                    }, 15000);

                    testSocket.on('open', () => {
                        clearTimeout(timeout);
                        testSocket.destroy();
                        resolve();
                    });

                    testSocket.on('error', (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    });
                });
                console.log('Connection established');
                break;
            } catch (err) {
                lastError = err;
                attempts--;
                if (attempts > 0) {
                    console.log(`Connection failed, retrying... (${attempts} attempts remaining)`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        if (attempts === 0) {
            throw lastError;
        }
        
        console.log('connection ready');
        
        const server = net.createServer({allowHalfOpen: false}, (local) => {
            console.log('new local connection on port ' + config.localPort + ', relaying to remote tcp ' + port);
            const socket = this.node.connect(publicKey, { reusableSocket: true });
            
            let destroyed = false;
            const cleanup = () => {
                if (!destroyed) {
                    destroyed = true;
                    socket.end();
                    local.end();
                }
            };

            const connectTimeout = setTimeout(() => {
                console.log('Connection timeout');
                cleanup();
            }, 15000);

            socket.on('open', () => {
                clearTimeout(connectTimeout);
                console.log('Remote connection established');
            });

            socket.on('error', (err) => {
                console.log('Remote connection error:', err.message);
                cleanup();
            });

            local.on('error', (err) => {
                console.log('Local connection error:', err.message);
                cleanup();
            });

            socket.on('end', () => {
                console.log('Remote connection ended naturally');
                local.end();
            });

            local.on('end', () => {
                console.log('Local connection ended naturally');
                socket.end();
            });

            pump(local, socket, local, (err) => {
                if (err) {
                    console.log('Pump error:', err.message);
                }
                cleanup();
            });
        });
        
        server.listen(config.localPort, "127.0.0.1");
        console.log('TCP stream ready, listening for connections on', port);
    }

    async createUdpServer(keyPair, port, host) {
        const server = this.node.createServer();
        server.on("connection", (conn) => {
            console.log('new connection, relaying to ' + port);
            const client = udp.createSocket('udp4');
            
            let destroyed = false;
            const cleanup = () => {
                if (!destroyed) {
                    destroyed = true;
                    client.close();
                    conn.end();
                }
            };

            client.on('error', (err) => {
                console.log('UDP client error:', err.message);
                cleanup();
            });

            conn.on('error', (err) => {
                console.log('UDP connection error:', err.message);
                cleanup();
            });

            conn.on('end', () => {
                console.log('UDP connection ended naturally');
                cleanup();
            });

            client.connect(port, host);
            
            client.on('message', (buf) => {
                if (!destroyed) {
                    try {
                        conn.rawStream.send(buf);
                    } catch (err) {
                        console.log('Error sending to remote:', err.message);
                        cleanup();
                    }
                }
            });

            conn.rawStream.on('message', (buf) => {
                if (!destroyed) {
                    try {
                        client.send(buf);
                    } catch (err) {
                        console.log('Error sending to local:', err.message);
                        cleanup();
                    }
                }
            });
        });
        console.log('listening for remote connections for udp', port);
        await server.listen(keyPair);
    }

    async createUdpClient(publicKey, port, config) {
        console.log('connecting to udp', port);
        const conn = await this.node.connect(publicKey);
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                conn.destroy();
                reject(new Error('Connection timeout after 15 seconds'));
            }, 15000);

            conn.on('open', () => {
                clearTimeout(timeout);
                resolve();
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        console.log('connection open');
        const server = udp.createSocket('udp4');
        let inport;
        server.on('message', async (buf, rinfo) => {
            if (!inport) {
                console.log('setting port', rinfo);
                inport = rinfo.port;
            }
            conn.rawStream.send(buf);
        });
        conn.rawStream.on('message', (buf) => {
            server.send(buf, inport);
        });
        server.bind(config.localPort);
        console.log('UDP stream ready, listening for packets on ', port);
    }

    async createTcpUdpServer(keyPair, port, host) {
        const server = this.node.createServer();
        server.on("connection", (conn) => {
            console.log('new connection, relaying to tcp-over-udp ' + port);
            const socket = net.connect({port, host, allowHalfOpen: true });
            
            socket.setNoDelay(true);
            socket.setTimeout(10000);
            
            let tcpEnded = false;
            let udpEnded = false;
            
            const gracefulClose = () => {
                if (tcpEnded && udpEnded) return;
                
                if (!tcpEnded && socket && !socket.destroyed) {
                    tcpEnded = true;
                    socket.end();
                }
                
                if (!udpEnded && conn && !conn.destroyed) {
                    udpEnded = true;
                    conn.end();
                }
            };
            
            socket.on('connect', () => {
                console.log('connected to local service');
                
                socket.on('data', (data) => {
                    try {
                        if (conn && !conn.destroyed && conn.rawStream) {
                            conn.rawStream.send(data);
                        }
                    } catch (err) {
                        console.log('error sending data to remote:', err.message);
                        gracefulClose();
                    }
                });
                
                conn.rawStream.on('message', (data) => {
                    try {
                        if (socket && !socket.destroyed && socket.writable) {
                            socket.write(data);
                        }
                    } catch (err) {
                        console.log('error writing data to local socket:', err.message);
                        gracefulClose();
                    }
                });
            });
            
            // Handle socket events
            this.setupTcpUdpSocketHandlers(socket, conn, gracefulClose);
        });
        console.log('listening for remote connections for tcp-over-udp', port);
        await server.listen(keyPair);
    }

    async createTcpUdpClient(publicKey, port, config) {
        console.log('connecting to tcp-over-udp', port);
        
        const testConn = await this.node.connect(publicKey);
        await new Promise(res => testConn.on('open', res));
        testConn.destroy();
        console.log('connection ready');
        
        const server = net.createServer({allowHalfOpen: true}, async (localSocket) => {
            console.log('new local tcp connection, relaying to remote tcp-over-udp', port);
            
            localSocket.setNoDelay(true);
            localSocket.setTimeout(10000);
            
            let tcpEnded = false;
            let udpEnded = false;
            
            const gracefulClose = () => {
                if (tcpEnded && udpEnded) return;
                
                if (!tcpEnded && localSocket && !localSocket.destroyed) {
                    tcpEnded = true;
                    localSocket.end();
                }
            };
            
            try {
                const conn = this.node.connect(publicKey);
                
                await new Promise((resolve, reject) => {
                    conn.on('open', resolve);
                    conn.on('error', reject);
                    setTimeout(() => reject(new Error('Connection timeout')), 10000);
                });
                
                localSocket.on('data', (data) => {
                    try {
                        if (conn && !conn.destroyed && conn.rawStream) {
                            conn.rawStream.send(data);
                        }
                    } catch (err) {
                        console.log('error sending data to remote:', err.message);
                        gracefulClose();
                    }
                });
                
                conn.rawStream.on('message', (data) => {
                    try {
                        if (localSocket && !localSocket.destroyed && localSocket.writable) {
                            localSocket.write(data);
                        }
                    } catch (err) {
                        console.log('error writing data to local socket:', err.message);
                        if (conn && !conn.destroyed) {
                            conn.end();
                        }
                    }
                });
                
                // Setup handlers for both sockets
                this.setupTcpUdpClientHandlers(localSocket, conn, gracefulClose, tcpEnded, udpEnded);
                
            } catch (err) {
                console.log('failed to connect to remote:', err.message);
                tcpEnded = true;
                localSocket.destroy();
            }
        });
        
        server.listen(config.localPort, "127.0.0.1");
        console.log('TCP-over-UDP stream ready, listening for connections on', config.localPort);
    }

    setupTcpUdpSocketHandlers(socket, conn, gracefulClose) {
        let tcpEnded = false;
        let udpEnded = false;

        socket.on('close', () => {
            console.log('local tcp connection closed');
            tcpEnded = true;
            if (conn && !conn.destroyed) {
                conn.end();
            }
        });
        
        socket.on('end', () => {
            console.log('local tcp connection ended');
            tcpEnded = true;
            if (conn && !conn.destroyed) {
                conn.end();
            }
        });
        
        socket.on('timeout', () => {
            console.log('local tcp socket timeout');
            gracefulClose();
        });
        
        socket.on('error', (err) => {
            console.log('local tcp socket error:', err.message);
            tcpEnded = true;
            if (conn && !conn.destroyed) {
                conn.destroy();
            }
        });
        
        conn.on('close', () => {
            console.log('remote udp connection closed');
            udpEnded = true;
            if (socket && !socket.destroyed) {
                if (socket.readyState === 'open') {
                    socket.end();
                } else {
                    socket.destroy();
                }
            }
        });
        
        conn.on('end', () => {
            console.log('remote udp connection ended');
            udpEnded = true;
            if (socket && !socket.destroyed) {
                socket.end();
            }
        });
        
        conn.on('error', (err) => {
            console.log('remote udp connection error:', err.message);
            udpEnded = true;
            if (socket && !socket.destroyed) {
                socket.destroy();
            }
        });
    }

    setupTcpUdpClientHandlers(localSocket, conn, gracefulClose, tcpEnded, udpEnded) {
        localSocket.on('close', () => {
            console.log('local tcp connection closed');
            tcpEnded = true;
            if (conn && !conn.destroyed) {
                conn.end();
            }
        });
        
        localSocket.on('end', () => {
            console.log('local tcp connection ended');
            tcpEnded = true;
            if (conn && !conn.destroyed) {
                conn.end();
            }
        });
        
        localSocket.on('timeout', () => {
            console.log('local tcp socket timeout');
            gracefulClose();
        });
        
        localSocket.on('error', (err) => {
            console.log('local tcp socket error:', err.message);
            tcpEnded = true;
            if (conn && !conn.destroyed) {
                conn.destroy();
            }
        });
        
        conn.on('close', () => {
            console.log('remote udp connection closed');
            udpEnded = true;
            if (localSocket && !localSocket.destroyed) {
                if (localSocket.readyState === 'open') {
                    localSocket.end();
                } else {
                    localSocket.destroy();
                }
            }
        });
        
        conn.on('end', () => {
            console.log('remote udp connection ended');
            udpEnded = true;
            if (localSocket && !localSocket.destroyed) {
                localSocket.end();
            }
        });
        
        conn.on('error', (err) => {
            console.log('remote udp connection error:', err.message);
            udpEnded = true;
            if (localSocket && !localSocket.destroyed) {
                localSocket.destroy();
            }
        });
    }
}

// Factory function to create relay instance
const createRelay = async () => {
    const relay = new DHTRelay();
    return await relay.createRelay();
};

module.exports = { DHTRelay, createRelay };