#!/usr/bin/env node

const { spawn } = require('child_process');
const { execSync } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

class ComprehensiveRelayTest {
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
        await this.sleep(2000); // Allow ports to be released
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

    async testProtocolRelay(protocol) {
        this.log(`\n=== Testing ${protocol.toUpperCase()} Protocol Relay ===`);
        
        const testResult = {
            protocol: protocol,
            timestamp: Date.now(),
            success: false,
            phases: {}
        };

        try {
            // Phase 1: Test direct HTTP connection
            this.log('Phase 1: Testing direct HTTP connection...');
            const directTest = await this.testHTTPRequest(this.httpServerPort);
            testResult.phases.direct = directTest;
            
            if (!directTest.success) {
                throw new Error(`Direct HTTP test failed: ${directTest.error}`);
            }
            this.log(`Direct HTTP: SUCCESS (${directTest.latency}ms)`);

            // Phase 2: Start hyper-nat server
            this.log(`Phase 2: Starting hyper-nat server (${protocol})...`);
            const secret = crypto.randomBytes(16).toString('hex');
            const relayPort = 9000 + this.getProtocolOffset(protocol);
            
            const serverProcess = spawn('node', ['index.js', 'server', '-p', this.httpServerPort.toString(), '--protocol', protocol, '-s', secret], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.processes.push({ process: serverProcess, name: `Hyper-nat Server (${protocol})` });

            // Extract public key from server output
            const publicKey = await this.extractPublicKey(serverProcess, protocol);
            testResult.phases.server = { success: true, publicKey: publicKey };
            this.log(`Server started with key: ${publicKey.substring(0, 16)}...`);

            // Phase 3: Start hyper-nat client
            this.log(`Phase 3: Starting hyper-nat client (${protocol})...`);
            
            const clientProcess = spawn('node', ['index.js', 'client', '-p', relayPort.toString(), '--protocol', protocol, '-k', publicKey], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.processes.push({ process: clientProcess, name: `Hyper-nat Client (${protocol})` });

            // Wait for client to be ready
            await this.waitForClientReady(clientProcess, protocol);
            testResult.phases.client = { success: true };
            this.log('Client ready');

            // Phase 4: Test relay functionality
            this.log('Phase 4: Testing relay functionality...');
            await this.sleep(2000); // Allow connection to stabilize
            
            const relayTest = await this.testHTTPRequest(relayPort);
            testResult.phases.relay = relayTest;
            
            if (!relayTest.success) {
                throw new Error(`Relay test failed: ${relayTest.error}`);
            }
            
            // Phase 5: Verify data integrity
            this.log('Phase 5: Testing data integrity...');
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
            this.log(`${protocol.toUpperCase()} relay test: SUCCESS`);
            this.log(`  Direct latency: ${directTest.latency}ms`);
            this.log(`  Relay latency: ${relayTest.latency}ms`);
            this.log(`  Overhead: ${relayTest.latency - directTest.latency}ms`);

        } catch (error) {
            testResult.error = error.message;
            this.log(`${protocol.toUpperCase()} relay test: FAILED - ${error.message}`);
        }

        this.results.push(testResult);
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
            }, 15000);

            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                const keyMatch = output.match(/npx hyper-nat client -p \d+ --protocol \w+ -k ([A-Za-z0-9]+)/);
                if (keyMatch) {
                    clearTimeout(timeout);
                    resolve(keyMatch[1]);
                }
            });

            serverProcess.stderr.on('data', (data) => {
                console.error(`Server stderr: ${data}`);
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

            clientProcess.stderr.on('data', (data) => {
                console.error(`Client stderr: ${data}`);
            });

            clientProcess.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async runAllTests() {
        this.log('🚀 COMPREHENSIVE HTTP RELAY TEST SUITE');
        this.log(`Test ID: ${this.testId}`);
        this.log(`Started: ${new Date(this.startTime).toISOString()}`);
        this.log('='.repeat(60));

        try {
            // Start HTTP server
            await this.startHTTPServer();
            await this.sleep(2000);

            // Test all protocols
            const protocols = ['tcp', 'udp', 'tcpudp'];
            for (const protocol of protocols) {
                await this.testProtocolRelay(protocol);
                await this.cleanup(); // Clean up between tests
                await this.sleep(3000); // Cool-down period
                
                // Restart HTTP server for next test
                if (protocols.indexOf(protocol) < protocols.length - 1) {
                    await this.startHTTPServer();
                    await this.sleep(2000);
                }
            }

            this.generateReport();

        } catch (error) {
            this.log(`Test suite failed: ${error.message}`);
        } finally {
            await this.cleanup();
        }
    }

    generateReport() {
        this.log('\n📊 TEST RESULTS SUMMARY');
        this.log('='.repeat(60));
        
        let totalTests = this.results.length;
        let passedTests = this.results.filter(r => r.success).length;
        
        this.results.forEach(result => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            this.log(`${result.protocol.toUpperCase().padEnd(7)} | ${status}`);
            if (result.error) {
                this.log(`         | Error: ${result.error}`);
            }
        });
        
        this.log('='.repeat(60));
        this.log(`Summary: ${passedTests}/${totalTests} tests passed`);
        this.log(`Duration: ${Date.now() - this.startTime}ms`);
        
        // Save detailed report
        const report = {
            testId: this.testId,
            timestamp: this.startTime,
            duration: Date.now() - this.startTime,
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: totalTests - passedTests
            },
            results: this.results
        };
        
        const reportFile = `comprehensive-relay-test-report-${this.testId}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        this.log(`Detailed report saved: ${reportFile}`);
    }
}

// Run the test if executed directly
if (require.main === module) {
    const tester = new ComprehensiveRelayTest();
    tester.runAllTests().catch(error => {
        console.error('Test suite error:', error);
        process.exit(1);
    });
}

module.exports = ComprehensiveRelayTest;
