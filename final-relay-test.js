#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

class FinalRelayTest {
    constructor() {
        this.testId = crypto.randomUUID();
        this.results = [];
        this.processes = [];
        this.httpServerPort = 8888;
        this.startTime = Date.now();
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
        await this.sleep(3000); // Allow ports to be released
    }

    async testHTTPRequest(port, path = '/health', timeout = 8000) {
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

    async testProtocolWithRetries(protocol, maxRetries = 2) {
        this.log(`\n=== Testing ${protocol.toUpperCase()} Protocol (with retries) ===`);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            this.log(`Attempt ${attempt}/${maxRetries} for ${protocol.toUpperCase()}`);
            
            try {
                const result = await this.testSingleProtocol(protocol, attempt);
                if (result.success) {
                    this.log(`✅ ${protocol.toUpperCase()} succeeded on attempt ${attempt}`);
                    return result;
                }
            } catch (error) {
                this.log(`❌ ${protocol.toUpperCase()} attempt ${attempt} failed: ${error.message}`);
                if (attempt < maxRetries) {
                    await this.cleanup();
                    await this.sleep(5000); // Wait between retries
                    await this.startHTTPServer();
                    await this.sleep(2000);
                }
            }
        }
        
        return { success: false, error: `All ${maxRetries} attempts failed` };
    }

    async testSingleProtocol(protocol, attempt = 1) {
        const testResult = {
            protocol: protocol,
            attempt: attempt,
            timestamp: Date.now(),
            success: false,
            phases: {}
        };

        try {
            // Phase 1: Test direct HTTP
            this.log('Phase 1: Testing direct HTTP connection...');
            const directTest = await this.testHTTPRequest(this.httpServerPort);
            testResult.phases.direct = directTest;
            
            if (!directTest.success) {
                throw new Error(`Direct HTTP test failed: ${directTest.error}`);
            }
            this.log(`✅ Direct HTTP: SUCCESS (${directTest.latency}ms)`);

            // Phase 2: Start hyper-nat server
            this.log(`Phase 2: Starting hyper-nat server (${protocol})...`);
            const secret = crypto.randomBytes(16).toString('hex');
            
            const serverProcess = spawn('node', ['index.js', 'server', '-p', this.httpServerPort.toString(), '--protocol', protocol, '-s', secret], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.processes.push({ process: serverProcess, name: `Hyper-nat Server (${protocol})` });

            // Extract public key from server output with extended timeout
            const publicKey = await this.extractPublicKey(serverProcess, protocol);
            testResult.phases.server = { success: true, publicKey: publicKey };
            this.log(`Server started with key: ${publicKey.substring(0, 16)}...`);

            // Phase 3: Extended DHT stabilization
            this.log(`Phase 3: DHT network stabilization (${protocol})...`);
            await this.sleep(10000); // Extended wait for DHT

            // Phase 4: Start hyper-nat client with retries
            this.log(`Phase 4: Starting hyper-nat client (${protocol})...`);
            const relayPort = 9000 + this.getProtocolOffset(protocol);
            
            const clientProcess = spawn('node', ['index.js', 'client', '-p', relayPort.toString(), '--protocol', protocol, '-k', publicKey], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.processes.push({ process: clientProcess, name: `Hyper-nat Client (${protocol})` });

            // Wait for client to be ready with extended timeout and retry logic
            await this.waitForClientReady(clientProcess, protocol);
            testResult.phases.client = { success: true };
            this.log('Client ready');

            // Phase 5: Connection stabilization
            this.log('Phase 5: Connection stabilization...');
            await this.sleep(5000);

            // Phase 6: Test relay functionality with retries
            this.log('Phase 6: Testing relay functionality...');
            let relayTest = null;
            for (let i = 0; i < 3; i++) {
                relayTest = await this.testHTTPRequest(relayPort);
                if (relayTest.success) break;
                this.log(`Relay attempt ${i + 1} failed, retrying...`);
                await this.sleep(2000);
            }
            
            testResult.phases.relay = relayTest;
            
            if (!relayTest.success) {
                throw new Error(`Relay test failed after retries: ${relayTest.error}`);
            }
            
            // Phase 7: Verify data integrity
            this.log('Phase 7: Testing data integrity...');
            const testData = `test-data-${protocol}-${Date.now()}`;
            const integrityTest = await this.testHTTPRequest(relayPort, `/echo?data=${testData}`);
            testResult.phases.integrity = integrityTest;
            
            if (!integrityTest.success) {
                throw new Error(`Integrity test failed: ${integrityTest.error}`);
            }

            // Verify the echoed data matches
            const responseData = JSON.parse(integrityTest.data);
            if (responseData.request.testData !== testData) {
                throw new Error(`Data integrity failed: expected '${testData}', got '${responseData.request.testData}'`);
            }

            testResult.success = true;
            this.log(`✅ ${protocol.toUpperCase()} relay test: SUCCESS`);
            this.log(`  Direct latency: ${directTest.latency}ms`);
            this.log(`  Relay latency: ${relayTest.latency}ms`);
            this.log(`  Overhead: ${relayTest.latency - directTest.latency}ms`);

        } catch (error) {
            testResult.error = error.message;
            this.log(`❌ ${protocol.toUpperCase()} relay test: FAILED - ${error.message}`);
        }

        return testResult;
    }

    getProtocolOffset(protocol) {
        const offsets = { tcp: 0, udp: 1, tcpudp: 2 };
        return offsets[protocol] || 0;
    }

    async extractPublicKey(serverProcess, protocol) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for ${protocol} server public key`));
            }, 20000);

            let keyFound = false;
            let serverListening = false;

            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                
                // Check for public key
                const keyMatch = output.match(/npx hyper-nat client -p \d+ --protocol \w+ -k ([A-Za-z0-9]+)/);
                if (keyMatch && !keyFound) {
                    keyFound = keyMatch[1];
                }

                // Check for server listening
                if (output.includes(`listening for remote connections for ${protocol}`)) {
                    serverListening = true;
                }

                // Both conditions met
                if (keyFound && serverListening) {
                    clearTimeout(timeout);
                    resolve(keyFound);
                }
            });

            serverProcess.stderr.on('data', (data) => {
                const errorOutput = data.toString();
                if (errorOutput.includes('Error:')) {
                    clearTimeout(timeout);
                    reject(new Error(`Server error: ${errorOutput}`));
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
            }, 45000); // Extended timeout

            let retryCount = 0;
            const maxRetries = 10;

            clientProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('stream ready') || output.includes('listening for connections')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });

            clientProcess.stderr.on('data', (data) => {
                const errorMsg = data.toString();
                if (errorMsg.includes('PEER_NOT_FOUND')) {
                    retryCount++;
                    this.log(`Peer not found (${retryCount}/${maxRetries}), waiting...`);
                    if (retryCount >= maxRetries) {
                        clearTimeout(timeout);
                        reject(new Error(`Peer not found after ${maxRetries} attempts`));
                    }
                } else if (errorMsg.includes('Error:') && !errorMsg.includes('PEER_NOT_FOUND')) {
                    clearTimeout(timeout);
                    reject(new Error(`Client error: ${errorMsg}`));
                }
            });

            clientProcess.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async runComprehensiveTest() {
        this.log('🚀 COMPREHENSIVE HTTP RELAY TEST SUITE (FINAL VERSION)');
        this.log(`Test ID: ${this.testId}`);
        this.log(`Started: ${new Date(this.startTime).toISOString()}`);
        this.log('='.repeat(70));

        const protocols = ['tcp', 'udp', 'tcpudp'];
        const results = [];

        try {
            // Start HTTP server
            await this.startHTTPServer();
            await this.sleep(2000);

            // Test each protocol with retries
            for (const protocol of protocols) {
                const result = await this.testProtocolWithRetries(protocol);
                results.push(result);
                
                // Clean up between tests
                await this.cleanup();
                await this.sleep(3000);
                
                // Restart HTTP server for next test (except last)
                if (protocol !== protocols[protocols.length - 1]) {
                    await this.startHTTPServer();
                    await this.sleep(2000);
                }
            }

            this.generateReport(results);

        } catch (error) {
            this.log(`Test suite failed: ${error.message}`);
        } finally {
            await this.cleanup();
        }
    }

    generateReport(results) {
        this.log('\n📊 FINAL TEST RESULTS SUMMARY');
        this.log('='.repeat(70));
        
        let totalTests = results.length;
        let passedTests = results.filter(r => r.success).length;
        
        results.forEach(result => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            this.log(`${result.protocol.toUpperCase().padEnd(7)} | ${status}`);
            if (result.error) {
                this.log(`         | Error: ${result.error}`);
            }
        });
        
        this.log('='.repeat(70));
        this.log(`Summary: ${passedTests}/${totalTests} tests passed`);
        this.log(`Duration: ${Date.now() - this.startTime}ms`);
        
        if (passedTests === totalTests) {
            this.log('🎉 ALL TESTS PASSED! HTTP relay functionality verified for all protocols.');
        } else {
            this.log('⚠️ Some tests failed. See individual results above.');
        }
        
        // Save detailed report
        const report = {
            testId: this.testId,
            timestamp: this.startTime,
            duration: Date.now() - this.startTime,
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: totalTests - passedTests,
                successRate: (passedTests / totalTests * 100).toFixed(1) + '%'
            },
            results: results
        };
        
        const reportFile = `final-relay-test-report-${this.testId}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        this.log(`Detailed report saved: ${reportFile}`);
    }
}

// Run the test if executed directly
if (require.main === module) {
    const tester = new FinalRelayTest();
    tester.runComprehensiveTest().catch(error => {
        console.error('Test suite error:', error);
        process.exit(1);
    });
}

module.exports = FinalRelayTest;