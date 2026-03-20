/**
 * Base Connection Handler
 * Provides common functionality for all connection types
 */
class BaseConnectionHandler {
    constructor(dhtNode, options = {}) {
        this.node = dhtNode;
        this.options = options;
        this.connections = new Map();
        this.connectionId = 0;
    }

    generateConnectionId() {
        return ++this.connectionId;
    }

    addConnection(id, connection) {
        this.connections.set(id, {
            ...connection,
            timestamp: Date.now()
        });
    }

    removeConnection(id) {
        return this.connections.delete(id);
    }

    getConnection(id) {
        return this.connections.get(id);
    }

    cleanupOldConnections(timeout = 30000) {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [id, conn] of this.connections.entries()) {
            if (now - conn.timestamp > timeout) {
                this.destroyConnection(id, conn);
                cleaned++;
            }
        }
        
        return cleaned;
    }

    destroyConnection(id, connection) {
        try {
            if (connection.socket && !connection.socket.destroyed) {
                connection.socket.destroy();
            }
            if (connection.servsock && !connection.servsock.destroyed) {
                connection.servsock.destroy();
            }
            if (connection.udpSocket) {
                connection.udpSocket.close();
            }
        } catch (error) {
            // Ignore cleanup errors
        }
        
        this.removeConnection(id);
    }

    setupErrorHandlers(socket, servsock, cleanup) {
        if (socket) {
            socket.on('error', (err) => {
                this.logger.error(`Socket error: ${err.message}`);
                cleanup();
            });
        }

        if (servsock) {
            servsock.on('error', (err) => {
                this.logger.error(`Server socket error: ${err.message}`);
                cleanup();
            });
        }
    }

    setupTimeoutHandlers(socket, timeout, cleanup) {
        if (socket && typeof socket.setTimeout === 'function') {
            socket.on('timeout', () => {
                this.logger.warn('Socket timeout');
                cleanup();
            });
            socket.setTimeout(timeout);
        }
    }

    createCleanupFunction(socket, servsock, udpSocket = null) {
        return () => {
            this.logger.debug('Connection ended, cleaning up');
            
            if (socket && !socket.destroyed) {
                socket.destroy();
            }
            
            if (servsock && !servsock.destroyed) {
                servsock.destroy();
            }
            
            if (udpSocket) {
                udpSocket.close();
            }
            
            // Clean up any tracked connections
            this.cleanupOldConnections(0);
        };
    }

    startCleanupInterval(interval = 10000, timeout = 30000) {
        return setInterval(() => {
            const cleaned = this.cleanupOldConnections(timeout);
            if (cleaned > 0) {
                this.logger.debug(`Cleaned up ${cleaned} old connections`);
            }
        }, interval);
    }

    stopCleanupInterval(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
        }
    }

    // Abstract method to be implemented by subclasses
    get logger() {
        // This should be overridden by subclasses
        return {
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };
    }
}

module.exports = BaseConnectionHandler;
