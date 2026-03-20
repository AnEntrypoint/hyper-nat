const net = require("net");
const pump = require("pump");
const { logger } = require('../utils/logger');

/**
 * TCP Server Relay Module
 * Handles incoming TCP connections and relays them to target host:port
 */
class TcpServerRelay {
    constructor(dhtNode) {
        this.node = dhtNode;
    }

    async createServer(keyPair, port, host) {
        const server = this.node.createServer({ reusableSocket: true });
        
        server.on("connection", (servsock) => {
            logger.info(`New TCP connection, relaying to port ${port}`);
            const socket = net.connect({
                port, 
                host, 
                allowHalfOpen: false,
                timeout: 15000
            });

            const cleanup = () => {
                logger.debug('TCP connection ended, cleaning up');
                servsock.destroy();
                socket.destroy();
            };

            socket.on('connect', () => {
                logger.debug('Connected to target, relaying data');
                pump(servsock, socket, servsock, cleanup);
            });

            socket.on('error', (err) => {
                logger.error(`TCP socket error: ${err.message}`);
                cleanup();
            });

            servsock.on('error', (err) => {
                logger.error(`Server socket error: ${err.message}`);
                cleanup();
            });

            socket.on('timeout', () => {
                logger.warn('TCP socket timeout');
                cleanup();
            });

            socket.setTimeout(15000);
        });

        await server.listen(keyPair);
        return server;
    }
}

module.exports = TcpServerRelay;
