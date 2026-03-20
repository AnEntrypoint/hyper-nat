const net = require("net");
const pump = require("pump");
const { logger } = require('../utils/logger');

class TcpClientRelay {
    constructor(dhtNode) {
        this.node = dhtNode;
    }

    async createClient(publicKey, port, options = {}) {
        const host = options.host || '127.0.0.1';
        const timeout = options.timeout || 15000;

        const socket = this.node.connect(publicKey, { reusableSocket: true });

        return new Promise((resolve, reject) => {
            socket.on('open', () => {
                logger.info('DHT connection established, creating local TCP socket');
                const localSocket = net.connect({
                    port,
                    host,
                    allowHalfOpen: false,
                });

                const cleanup = () => {
                    logger.debug('TCP client connection ended, cleaning up');
                    localSocket.destroy();
                    socket.end();
                };

                localSocket.on('connect', () => {
                    logger.debug('Connected to local TCP target, relaying data');
                    pump(socket, localSocket, socket, cleanup);
                    resolve(socket);
                });

                localSocket.on('error', (err) => {
                    logger.error(`Local socket error: ${err.message}`);
                    cleanup();
                    reject(err);
                });

                socket.on('error', (err) => {
                    logger.error(`DHT socket error: ${err.message}`);
                    cleanup();
                    reject(err);
                });

                localSocket.on('timeout', () => {
                    logger.warn('Local socket timeout');
                    cleanup();
                    reject(new Error('Local socket timeout'));
                });

                localSocket.setTimeout(timeout);
            });

            socket.on('error', (err) => {
                logger.error(`DHT connection error: ${err.message}`);
                reject(err);
            });
        });
    }
}

module.exports = TcpClientRelay;
