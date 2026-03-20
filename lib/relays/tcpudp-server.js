const net = require("net");
const udp = require('dgram');
const pump = require("pump");
const BaseConnectionHandler = require('../utils/base-handler');
const { logger } = require('../utils/logger');

/**
 * TCP-UDP Server Relay Module
 * Handles incoming TCP connections and relays them as UDP packets to target host:port
 */
class TcpUdpServerRelay extends BaseConnectionHandler {
    constructor(dhtNode) {
        super(dhtNode);
    }

    async createServer(keyPair, port, host) {
        const server = this.node.createServer({ reusableSocket: true });
        
        server.on("connection", (servsock) => {
            console.log('new tcp connection for udp relay to ' + port);
            const socket = udp.createSocket('udp4');
            // Use inherited connections map from base class
            // Use inherited connection ID from base class
            
            const gracefulClose = this.createCleanupFunction(socket, servsock, socket);

            // Setup handlers for UDP socket events
            this.setupTcpUdpSocketHandlers(socket, servsock, port, host, gracefulClose);
            
            // Handle data from TCP connection and convert to UDP
            servsock.on('data', (data) => {
                const connId = this.generateConnectionId();
                this.addConnection(connId, { servsock, socket });
                
                try {
                    socket.send(data, port, host, (err) => {
                        if (err) {
                            console.error('tcpudp send error:', err.message);
                            udpConnections.delete(connId);
                        }
                    });
                } catch (error) {
                    console.error('tcpudp send exception:', error.message);
                    udpConnections.delete(connId);
                }
            });

            // Use pump for bidirectional relay
            pump(servsock, socket, servsock, gracefulClose);
        });

        await server.listen(keyPair);
        return server;
    }

    setupTcpUdpSocketHandlers(socket, servsock, udpConnections, port, host, gracefulClose) {
        // Handle UDP responses and route back to TCP connections
        socket.on('message', (msg, rinfo) => {
            if (servsock.destroyed === false) {
                servsock.write(msg);
            }
        });

        socket.on('error', (err) => {
            console.error('tcpudp socket error:', err.message);
            gracefulClose();
        });

        servsock.on('error', (err) => {
            console.error('tcpudp servsock error:', err.message);
            gracefulClose();
        });

        // Cleanup old UDP connections periodically
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [connId, conn] of udpConnections.entries()) {
                if (now - conn.timestamp > 30000) { // 30 second timeout
                    udpConnections.delete(connId);
                }
            }
        }, 10000);

        servsock.on('close', () => {
            clearInterval(cleanupInterval);
        });
    }
}

module.exports = TcpUdpServerRelay;
