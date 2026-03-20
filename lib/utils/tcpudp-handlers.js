const { logger } = require('../utils/logger');

/**
 * TCP-UDP Client Handler Utilities
 * Extracted from tcpudp-client.js to reduce complexity
 */
class TcpUdpClientHandlers {
    
    static setupHandlers(udpSocket, socket, tcpConnections, port, host, gracefulClose) {
        // Handle UDP responses and route back to TCP connections
        udpSocket.on('message', (msg, rinfo) => {
            if (socket.destroyed === false) {
                socket.write(msg);
            }
        });

        udpSocket.on('error', (err) => {
            logger.error(`TCP-UDP client UDP socket error: ${err.message}`);
            gracefulClose();
        });

        socket.on('error', (err) => {
            logger.error(`TCP-UDP client socket error: ${err.message}`);
            gracefulClose();
        });

        // Cleanup old TCP connections periodically
        const cleanupInterval = TcpUdpClientHandlers.startCleanupInterval(
            tcpConnections, 
            10000, // 10 second interval
            30000  // 30 second timeout
        );

        socket.on('close', () => {
            clearInterval(cleanupInterval);
        });
    }

    static startCleanupInterval(connections, intervalMs, timeoutMs) {
        return setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [connId, conn] of connections.entries()) {
                if (now - conn.timestamp > timeoutMs) {
                    connections.delete(connId);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                logger.debug(`Cleaned up ${cleaned} old TCP-UDP connections`);
            }
        }, intervalMs);
    }
}

module.exports = TcpUdpClientHandlers;
