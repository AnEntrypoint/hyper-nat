const udp = require('dgram');
const pump = require("pump");
const { ErrorHandler } = require('../utils/error-handler');
const { logger } = require('../utils/logger');

/**
 * UDP Server Relay Module
 * Handles incoming UDP packets and relays them to target host:port
 */
class UdpServerRelay {
    constructor(dhtNode) {
        this.node = dhtNode;
    }

    async createServer(keyPair, port, host) {
        const server = this.node.createServer({ reusableSocket: true });
        
        server.on("connection", (servsock) => {
            logger.info(`New UDP connection, creating socket to port ${port}`);
            const socket = udp.createSocket('udp4');
            
            // Track UDP socket connections
            const udpConnections = new Map();
            
            const cleanup = () => {
                logger.debug('UDP server connection ended, cleaning up');
                socket.close();
                servsock.destroy();
                udpConnections.clear();
            };

            // Handle data from DHT connection
            servsock.on('data', (data) => {
                try {
                    socket.send(data, port, host, (err) => {
                        if (err) {
                            ErrorHandler.handle(ErrorHandler.createConnectionError(err.message, 'udp'), 'UDP send');
                            cleanup();
                        }
                    });
                } catch (error) {
                    ErrorHandler.handle(ErrorHandler.createConnectionError(error.message, 'udp'), 'UDP send');
                    cleanup();
                }
            });

            // Handle responses from UDP socket
            socket.on('message', (msg, rinfo) => {
                if (servsock.destroyed === false) {
                    servsock.write(msg);
                }
            });

            socket.on('error', (err) => {
                ErrorHandler.handle(ErrorHandler.createConnectionError(err.message, 'udp'), 'UDP socket');
                cleanup();
            });

            servsock.on('error', (err) => {
                ErrorHandler.handle(ErrorHandler.createConnectionError(err.message, 'server'), 'UDP server socket');
                cleanup();
            });

            // Setup pump for bi-directional relay
            pump(servsock, socket, servsock, cleanup);
        });

        await server.listen(keyPair);
        return server;
    }
}

module.exports = UdpServerRelay;
