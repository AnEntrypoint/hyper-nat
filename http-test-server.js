#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

class HTTPTestServer {
    constructor(port, mode = 'direct', serverId = null) {
        this.port = port;
        this.mode = mode;
        this.serverId = serverId || crypto.randomUUID();
        this.requestCount = 0;
        this.startTime = Date.now();
        this.server = null;
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.listen(this.port, '127.0.0.1', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`HTTP Test Server [${this.mode}] running on http://127.0.0.1:${this.port}`);
                    console.log(`Server ID: ${this.serverId}`);
                    resolve();
                }
            });

            this.server.on('error', reject);
        });
    }

    handleRequest(req, res) {
        this.requestCount++;
        const requestId = crypto.randomUUID();
        const timestamp = Date.now();
        const uptime = timestamp - this.startTime;

        // Parse URL and query parameters
        const url = new URL(req.url, `http://127.0.0.1:${this.port}`);
        const testData = url.searchParams.get('data') || 'default-test-data';
        const expectedSize = parseInt(url.searchParams.get('size')) || 0;

        // Log request details
        console.log(`[${this.mode}:${this.port}] Request #${this.requestCount} - ${req.method} ${req.url}`);
        console.log(`  Request ID: ${requestId}`);
        console.log(`  Client: ${req.connection.remoteAddress}:${req.connection.remotePort}`);

        // Generate response based on endpoint
        let responseData;
        let statusCode = 200;
        let contentType = 'application/json';

        if (url.pathname === '/health') {
            responseData = this.getHealthResponse(requestId, timestamp, uptime);
        } else if (url.pathname === '/echo') {
            responseData = this.getEchoResponse(req, requestId, timestamp, testData);
        } else if (url.pathname === '/large') {
            const size = expectedSize || 1024;
            responseData = this.getLargeResponse(requestId, timestamp, size);
        } else if (url.pathname === '/latency') {
            responseData = this.getLatencyResponse(requestId, timestamp, uptime);
        } else {
            statusCode = 404;
            responseData = this.getNotFoundResponse(requestId, timestamp);
        }

        // Set response headers
        res.statusCode = statusCode;
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Server-Mode', this.mode);
        res.setHeader('X-Server-ID', this.serverId);
        res.setHeader('X-Request-ID', requestId);
        res.setHeader('X-Timestamp', timestamp.toString());
        res.setHeader('X-Request-Count', this.requestCount.toString());
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Send response
        const responseString = JSON.stringify(responseData, null, 2);
        res.end(responseString);

        console.log(`  Response: ${statusCode} (${responseString.length} bytes)`);
    }

    getHealthResponse(requestId, timestamp, uptime) {
        return {
            status: 'healthy',
            server: {
                id: this.serverId,
                mode: this.mode,
                port: this.port,
                uptime: uptime,
                requestCount: this.requestCount
            },
            request: {
                id: requestId,
                timestamp: timestamp,
                localTime: new Date(timestamp).toISOString()
            }
        };
    }

    getEchoResponse(req, requestId, timestamp, testData) {
        return {
            echo: true,
            server: {
                id: this.serverId,
                mode: this.mode,
                port: this.port
            },
            request: {
                id: requestId,
                timestamp: timestamp,
                method: req.method,
                url: req.url,
                headers: req.headers,
                testData: testData
            },
            integrity: {
                dataHash: crypto.createHash('sha256').update(testData).digest('hex'),
                headerHash: crypto.createHash('sha256').update(JSON.stringify(req.headers)).digest('hex')
            }
        };
    }

    getLargeResponse(requestId, timestamp, size) {
        const data = 'A'.repeat(Math.max(1, size - 500)); // Reserve space for metadata
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        
        return {
            type: 'large_response',
            server: {
                id: this.serverId,
                mode: this.mode,
                port: this.port
            },
            request: {
                id: requestId,
                timestamp: timestamp
            },
            payload: {
                size: data.length,
                hash: hash,
                data: data
            }
        };
    }

    getLatencyResponse(requestId, timestamp, uptime) {
        const processingStart = process.hrtime.bigint();
        
        // Simulate small processing delay
        const iterations = 1000;
        let sum = 0;
        for (let i = 0; i < iterations; i++) {
            sum += Math.random();
        }
        
        const processingEnd = process.hrtime.bigint();
        const processingTime = Number(processingEnd - processingStart) / 1000000; // Convert to milliseconds

        return {
            type: 'latency_test',
            server: {
                id: this.serverId,
                mode: this.mode,
                port: this.port,
                uptime: uptime
            },
            request: {
                id: requestId,
                timestamp: timestamp,
                processingTime: processingTime
            },
            timing: {
                serverReceived: timestamp,
                processingMs: processingTime,
                randomSum: sum
            }
        };
    }

    getNotFoundResponse(requestId, timestamp) {
        return {
            error: 'Not Found',
            message: 'Available endpoints: /health, /echo, /large, /latency',
            server: {
                id: this.serverId,
                mode: this.mode,
                port: this.port
            },
            request: {
                id: requestId,
                timestamp: timestamp
            }
        };
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log(`HTTP Test Server [${this.mode}:${this.port}] stopped`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const port = parseInt(args[0]) || 8080;
    const mode = args[1] || 'direct';
    const serverId = args[2] || null;

    const server = new HTTPTestServer(port, mode, serverId);
    
    server.start().catch((err) => {
        console.error('Failed to start HTTP test server:', err);
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        server.stop().then(() => {
            process.exit(0);
        });
    });

    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        server.stop().then(() => {
            process.exit(0);
        });
    });
}

module.exports = HTTPTestServer;