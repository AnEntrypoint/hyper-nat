
        });

        udpSocket.on('error', (err) => {
            console.error('tcpudp client udp socket error:', err.message);
            gracefulClose();
        });

        socket.on('error', (err) => {
            console.error('tcpudp client socket error:', err.message);
            gracefulClose();
        });

        // Cleanup old TCP connections periodically
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [connId, conn] of tcpConnections.entries()) {
                if (now - conn.timestamp > 30000) { // 30 second timeout
                    tcpConnections.delete(connId);
                }
            }
        }, 10000);

        socket.on('close', () => {
            clearInterval(cleanupInterval);
        });
    }
}

module.exports = TcpUdpClientRelay;
