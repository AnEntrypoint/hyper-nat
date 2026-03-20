const udp = require('dgram');
const { logger } = require('../utils/logger');

class TcpUdpClientRelay {
    constructor(dhtNode) {
        this.node = dhtNode;
    }

    async createClient(publicKey, port, options = {}) {
        const host = options.host || '127.0.0.1';
        const socket = this.node.connect(publicKey, { reusableSocket: true });
        const tcpConnections = new Map();
        let connId = 0;

        return new Promise((resolve, reject) => {
            socket.on('open', () => {
                logger.info('DHT TCP-UDP connection established');
                const udpSocket = udp.createSocket('udp4');

                const gracefulClose = () => {
                    logger.debug('TCP-UDP client connection ended, cleaning up');
                    try { udpSocket.close(); } catch (_) {}
                    socket.end();
                    tcpConnections.clear();
                };

                socket.on('data', (data) => {
                    const id = ++connId;
                    tcpConnections.set(id, { timestamp: Date.now() });
                    try {
                        udpSocket.send(data, port, host, (err) => {
                            if (err) {
                                logger.error(`TCP-UDP client send error: ${err.message}`);
                                tcpConnections.delete(id);
                            }
                        });
                    } catch (error) {
                        logger.error(`TCP-UDP client send exception: ${error.message}`);
                        tcpConnections.delete(id);
                    }
                });

                udpSocket.on('message', (msg) => {
                    if (!socket.destroyed) socket.write(msg);
                });

                udpSocket.on('error', (err) => {
                    logger.error(`TCP-UDP client UDP socket error: ${err.message}`);
                    gracefulClose();
                });

                socket.on('error', (err) => {
                    logger.error(`TCP-UDP client socket error: ${err.message}`);
                    gracefulClose();
                });

                const cleanupInterval = setInterval(() => {
                    const now = Date.now();
                    for (const [id, conn] of tcpConnections.entries()) {
                        if (now - conn.timestamp > 30000) tcpConnections.delete(id);
                    }
                }, 10000);

                socket.on('close', () => clearInterval(cleanupInterval));

                resolve(socket);
            });

            socket.on('error', (err) => {
                logger.error(`TCP-UDP DHT connection error: ${err.message}`);
                reject(err);
            });
        });
    }
}

module.exports = TcpUdpClientRelay;
