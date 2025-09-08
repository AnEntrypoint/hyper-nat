#!/usr/bin/env node

const { spawn } = require('child_process');
const crypto = require('crypto');

console.log('🛠️  MANUAL HTTP RELAY TEST GUIDE');
console.log('='.repeat(50));
console.log('This script helps you manually test HTTP relay functionality.');
console.log('Follow the steps below to test each protocol mode.\n');

class ManualTestGuide {
    constructor() {
        this.httpServerPort = 8888;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async startHTTPServer() {
        console.log('Step 1: Starting HTTP test server...');
        console.log(`Command: node http-test-server.js ${this.httpServerPort} manual-test`);
        
        const serverProcess = spawn('node', ['http-test-server.js', this.httpServerPort.toString(), 'manual-test'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        serverProcess.stdout.on('data', (data) => {
            console.log('HTTP Server:', data.toString().trim());
        });

        serverProcess.stderr.on('data', (data) => {
            console.log('HTTP Server Error:', data.toString().trim());
        });

        console.log('✅ HTTP server started. Test it with:');
        console.log(`   curl http://127.0.0.1:${this.httpServerPort}/health`);
        console.log(`   curl "http://127.0.0.1:${this.httpServerPort}/echo?data=test123"`);
        console.log('');

        return serverProcess;
    }

    showProtocolTest(protocol) {
        console.log(`\n🔧 TESTING ${protocol.toUpperCase()} PROTOCOL`);
        console.log('-'.repeat(40));
        
        const secret = crypto.randomBytes(16).toString('hex');
        const relayPort = 9000 + (protocol === 'udp' ? 1 : protocol === 'tcpudp' ? 2 : 0);
        
        console.log('Step 2: Start hyper-nat server (in a new terminal):');
        console.log(`   node index.js server -p ${this.httpServerPort} --protocol ${protocol} -s ${secret}`);
        console.log('');
        console.log('Step 3: Copy the public key from the server output.');
        console.log('        It will look like: npx hyper-nat client -p ... -k <PUBLIC_KEY>');
        console.log('');
        console.log('Step 4: Start hyper-nat client (in another new terminal):');
        console.log(`   node index.js client -p ${relayPort} --protocol ${protocol} -k <PUBLIC_KEY>`);
        console.log('');
        console.log('Step 5: Test the relay (wait for client to show "ready"):');
        console.log(`   curl http://127.0.0.1:${relayPort}/health`);
        console.log(`   curl "http://127.0.0.1:${relayPort}/echo?data=relay-test-${protocol}"`);
        console.log('');
        console.log('Step 6: Verify the response shows the test data and server info.');
        console.log(`        The response should contain "relay-test-${protocol}"`);
        console.log('');
        console.log('Step 7: Stop the hyper-nat processes (Ctrl+C) before testing next protocol.');
        console.log('');
    }

    async runGuide() {
        console.log('This guide will help you manually test all three protocols:');
        console.log('- TCP: Direct TCP tunnel');
        console.log('- UDP: Direct UDP tunnel');  
        console.log('- TCPUDP: TCP-over-UDP tunnel');
        console.log('');

        // Start HTTP server
        const httpServer = await this.startHTTPServer();

        // Show test instructions for each protocol
        const protocols = ['tcp', 'udp', 'tcpudp'];
        for (const protocol of protocols) {
            this.showProtocolTest(protocol);
            
            if (protocol !== 'tcpudp') {
                console.log('Press Ctrl+C to continue to next protocol, or let this run in background...');
                await this.sleep(5000);
            }
        }

        console.log('\n📝 EXPECTED RESULTS:');
        console.log('='.repeat(50));
        console.log('For ALL protocols, you should see:');
        console.log('1. HTTP health check returns status 200 with server info');
        console.log('2. Echo endpoint returns the test data you sent');
        console.log('3. Response includes integrity hashes and server details');
        console.log('4. Relay latency should be higher than direct HTTP latency');
        console.log('');
        console.log('If any protocol fails:');
        console.log('- Check that both server and client show "ready" status');
        console.log('- Verify the public key was copied correctly');
        console.log('- Ensure no other processes are using the ports');
        console.log('- Allow extra time for DHT peer discovery (up to 30 seconds)');
        console.log('');
        console.log('🎉 If all protocols work, HTTP relay is functioning correctly!');

        // Keep HTTP server running
        console.log('HTTP server will continue running. Press Ctrl+C to stop.');
        
        process.on('SIGINT', () => {
            console.log('\\nShutting down HTTP server...');
            httpServer.kill();
            process.exit(0);
        });
    }
}

if (require.main === module) {
    const guide = new ManualTestGuide();
    guide.runGuide().catch(console.error);
}

module.exports = ManualTestGuide;