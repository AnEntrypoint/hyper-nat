#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');

class QuickRelayTest {
    constructor() {
        this.testId = crypto.randomUUID();
        this.processes = [];
        this.httpServerPort = 8888;
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async killProcess(process, name) {
        if (process && !process.killed) {
            this.log(`Killing ${name}...`);
            process.kill('SIGTERM');
            await this.sleep(1000);
            if (!process.killed) {
                process.kill('SIGKILL');
            }
        }
    }

    async cleanup() {
        this.log('Starting cleanup...');
        for (const proc of this.processes) {
            await this.killProcess(proc.process, proc.name);
        }
        this.processes = [];
        await this.sleep(2000);
    }

    async testHTTPRequest(port, path = '/health', timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const req = http.request({
                hostname: '127.0.0.1',
                port: port,
                path: path,
                method: 'GET',
                timeout: timeout
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const latency = Date.now() - startTime;
                    resolve({
                        success: true,
                        statusCode: res.statusCode,
                        data: data,
                        latency: latency
                    });
                });
            });

            req.on('error', (err) => {
                resolve({
                    success: false,
                    error: err.message,
                    latency: Date.now() - startTime
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout',
                    latency: Date.now() - startTime
                });
            });

            req.end();
        });
    }

    async startHTTPServer() {
        this.log(`Starting HTTP server on port ${this.httpServerPort}...`);
        
        const serverProcess = spawn('node', ['http-test-server.js', this.httpServerPort.toString(), 'relay-test'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.processes.push({ process: serverProcess, name: 'HTTP Server' });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('HTTP server startup timeout'));
            }, 10000);

            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('HTTP Test Server') && output.includes('running on')) {
                    clearTimeout(timeout);
                    this.log('HTTP server ready');
                    resolve();
                }
            });

            serverProcess.stderr.on('data', (data) => {
                console.error('HTTP Server Error:', data.toString());
            });

            serverProcess.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async testSingleProtocol(protocol) {
        this.log(`\n=== Testing ${protocol.toUpperCase()} Protocol ===`);
        
        try {
            // Test direct HTTP first
            this.log('Testing direct HTTP connection...');
            const directTest = await this.testHTTPRequest(this.httpServerPort);
            if (!directTest.success) {
                throw new Error(`Direct HTTP failed: ${directTest.error}`);
            }
            this.log(`✅ Direct HTTP: SUCCESS (${directTest.latency}ms)`);

            // Start hyper-nat server
            this.log(`Starting hyper-nat server (${protocol})...`);
            const secret = crypto.randomBytes(16).toString('hex');
            
            const serverProcess = spawn('node', ['index.js', 'server', '-p', this.httpServerPort.toString(), '--protocol', protocol, '-s', secret], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.processes.push({ process: serverProcess, name: `Hyper-nat Server (${protocol})` });

            // Get public key
            const publicKey = await this.extractPublicKey(serverProcess, protocol);
            this.log(`Server ready with key: ${publicKey.substring(0, 16)}...`);

            // Start hyper-nat client
            this.log(`Starting hyper-nat client (${protocol})...`);
            const relayPort = 9000;
            
            const clientProcess = spawn('node', ['index.js', 'client', '-p', relayPort.toString(), '--protocol', protocol, '-k', publicKey], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.processes.push({ process: clientProcess, name: `Hyper-nat Client (${protocol})` });

            // Wait for client ready
            await this.waitForClientReady(clientProcess, protocol);
            this.log('Client ready, testing relay...');

            // Give connection time to stabilize
            await this.sleep(3000);

            // Test relay
            const relayTest = await this.testHTTPRequest(relayPort);
            if (!relayTest.success) {
                throw new Error(`Relay test failed: ${relayTest.error}`);
            }

            this.log(`✅ ${protocol.toUpperCase()} relay: SUCCESS (${relayTest.latency}ms, overhead: ${relayTest.latency - directTest.latency}ms)`);
            
            // Test data integrity
            const testData = `test-${protocol}-${Date.now()}`;
            const integrityTest = await this.testHTTPRequest(relayPort, `/echo?data=${testData}`);
            
            if (integrityTest.success) {
                const responseData = JSON.parse(integrityTest.data);
                if (responseData.request.testData === testData) {
                    this.log(`✅ Data integrity: SUCCESS`);
                    return true;
                } else {
                    this.log(`❌ Data integrity: FAILED - data mismatch`);
                    return false;
                }
            } else {
                this.log(`❌ Data integrity: FAILED - ${integrityTest.error}`);
                return false;
            }

        } catch (error) {
            this.log(`❌ ${protocol.toUpperCase()} test FAILED: ${error.message}`);
            return false;
        }
    }

    async extractPublicKey(serverProcess, protocol) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for ${protocol} server public key`));
            }, 15000);

            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                const keyMatch = output.match(/npx hyper-nat client -p \d+ --protocol \w+ -k ([A-Za-z0-9]+)/);
                if (keyMatch) {
                    clearTimeout(timeout);
                    resolve(keyMatch[1]);
                }
            });

            serverProcess.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async waitForClientReady(clientProcess, protocol) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for ${protocol} client`));
            }, 15000);

            clientProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('stream ready') || output.includes('listening for connections')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });

            clientProcess.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async runQuickTest() {
        this.log('🚀 QUICK HTTP RELAY TEST');
        this.log(`Test ID: ${this.testId}`);
        this.log('='.repeat(50));

        let results = [];

        try {
            // Start HTTP server
            await this.startHTTPServer();
            await this.sleep(2000);

            // Test each protocol
            for (const protocol of ['tcp', 'udp', 'tcpudp']) {
                const success = await this.testSingleProtocol(protocol);
                results.push({ protocol, success });
                
                // Clean up between tests
                await this.cleanup();
                await this.sleep(2000);
                
                // Restart HTTP server for next test
                if (protocol !== 'tcpudp') {
                    await this.startHTTPServer();
                    await this.sleep(2000);
                }
            }

            // Summary
            this.log('\n📊 RESULTS SUMMARY');
            this.log('='.repeat(50));
            results.forEach(result => {
                const status = result.success ? '✅ PASS' : '❌ FAIL';
                this.log(`${result.protocol.toUpperCase().padEnd(7)} | ${status}`);
            });
            
            const passed = results.filter(r => r.success).length;
            this.log(`\nSummary: ${passed}/${results.length} tests passed`);

        } catch (error) {
            this.log(`Test suite failed: ${error.message}`);
        } finally {
            await this.cleanup();
        }
    }
}

// Run the test
if (require.main === module) {
    const tester = new QuickRelayTest();
    tester.runQuickTest().catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

module.exports = QuickRelayTest;