const DHT = require("@hyperswarm/dht");

// Import extracted relay modules
const TcpServerRelay = require('./relays/tcp-server');
const TcpClientRelay = require('./relays/tcp-client');
const UdpServerRelay = require('./relays/udp-server');
const UdpClientRelay = require('./relays/udp-client');
const TcpUdpServerRelay = require('./relays/tcpudp-server');
const TcpUdpClientRelay = require('./relays/tcpudp-client');

/**
 * DHT Relay functionality for hyper-nat
 * Handles TCP, UDP, and TCP-over-UDP protocols using modular relay components
 */
class DHTRelay {
    constructor() {
        this.node = null;
        
        // Initialize relay components
        this.tcpServer = null;
        this.tcpClient = null;
        this.udpServer = null;
        this.udpClient = null;
        this.tcpUdpServer = null;
        this.tcpUdpClient = null;
    }

    async initialize() {
        if (!this.node) {
            this.node = new DHT();
            await this.node.ready();
            
            // Initialize relay components
            this.tcpServer = new TcpServerRelay(this.node);
            this.tcpClient = new TcpClientRelay(this.node);
            this.udpServer = new UdpServerRelay(this.node);
            this.udpClient = new UdpClientRelay(this.node);
            this.tcpUdpServer = new TcpUdpServerRelay(this.node);
            this.tcpUdpClient = new TcpUdpClientRelay(this.node);
        }
        return this;
    }

    async createRelay() {
        await this.initialize();
        
        return {
            tcp: {
                server: this.tcpServer.createServer.bind(this.tcpServer),
                client: this.tcpClient.createClient.bind(this.tcpClient)
            },
            udp: {
                server: this.udpServer.createServer.bind(this.udpServer),
                client: this.udpClient.createClient.bind(this.udpClient)
            },
            tcpudp: {
                server: this.tcpUdpServer.createServer.bind(this.tcpUdpServer),
                client: this.tcpUdpClient.createClient.bind(this.tcpUdpClient)
            }
        };
    }

    async destroy() {
        if (this.node) {
            await this.node.destroy();
            this.node = null;
        }
    }
}

// Factory function to create relay instance
async function createRelay() {
    const relay = new DHTRelay();
    await relay.initialize();
    return relay;
}

module.exports = { DHTRelay, createRelay };
