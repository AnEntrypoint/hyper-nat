const udp = require('dgram');
const pump = require("pump");

/**
 * UDP Client Relay Module
 * Connects to remote DHT peer and relays to local UDP port
 */
class UdpClientRelay {
    constructor(dhtNode) {
        this.node = dhtNode;
    }

    async createClient(publicKey, port, config = {}) {
        const {
            host = '127.0.0.1',
            timeout = 15000
        } = config;

        const socket = this.node.connect(publicKey, { reusableSocket: true });
        
        return new Promise((resolve, reject) => {
            socket.on('open', () => {
                console.log('dht udp connection established, creating local udp socket');
                const udpSocket = udp.createSocket('udp4');
                
                const cleanup = () => {
                    console.log('udp client connection ended, cleaning up');
                    udpSocket.close();
                    socket.end();
                };

                // Handle data from DHT connection
                socket.on('data', (data) => {
                    try {
                        udpSocket.send(data, port, host, (err) => {
                            if (err) {
                                console.error('udp client send error:', err.message);
                            }
                        });
                    } catch (error) {
                        console.error('udp client send exception:', error.message);
                    }
                });

                // Handle responses from local UDP socket
                udpSocket.on('message', (msg, rinfo) => {
                    if (socket.destroyed === false) {
                        socket.write(msg);
                    }
                });

                udpSocket.on('error', (err) => {
                    console.error('local udp socket error:', err.message);
                    cleanup();
                    reject(err);
                });

                socket.on('error', (err) => {
                    console.error('dht udp socket error:', err.message);
                    cleanup();
                    reject(err);
                });

                resolve(socket);
            });

            socket.on('error', (err) => {
                console.error('dht udp connection error:', err.message);
                reject(err);
            });
        });
    }
}

module.exports = UdpClientRelay;
