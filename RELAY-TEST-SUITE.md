# HTTP Relay Test Suite

This directory contains comprehensive test scripts to verify HTTP relay functionality through all three protocol modes (TCP, UDP, TCPUDP) in the hyper-nat system.

## Test Scripts Overview

### 1. `final-relay-test.js` - Automated Comprehensive Test
**Purpose**: Fully automated test that verifies all three protocol modes sequentially.

**Features**:
- ✅ Real HTTP server on port 8888 with identifiable responses
- ✅ Tests TCP, UDP, and TCPUDP protocols sequentially  
- ✅ Extracts public keys from server output automatically
- ✅ Manages background processes with proper cleanup
- ✅ Uses real HTTP requests (not simulations)
- ✅ Verifies response data integrity
- ✅ Includes retry logic for peer discovery issues
- ✅ Generates JSON report with detailed results

**Usage**:
```bash
node final-relay-test.js
```

**Expected Output**:
- Start HTTP server on port 8888
- Test each protocol mode with relay functionality
- Show latency comparisons (direct vs relay)  
- Generate pass/fail results for each protocol
- Save detailed JSON report

### 2. `quick-relay-test.js` - Focused Test
**Purpose**: Streamlined test for faster verification.

**Features**:
- Simplified test flow
- Tests all three protocols
- Less retry logic for faster execution
- Good for development/debugging

**Usage**:
```bash
node quick-relay-test.js
```

### 3. `comprehensive-relay-test.js` - Full-Featured Test
**Purpose**: Most comprehensive test with extensive logging and error handling.

**Features**:
- Detailed phase-by-phase testing
- Extensive error reporting
- Capability analysis for each protocol
- JSON report generation
- Maximum observability

**Usage**:
```bash
node comprehensive-relay-test.js
```

### 4. `manual-test-guide.js` - Interactive Guide
**Purpose**: Step-by-step manual testing guide for human verification.

**Features**:
- Starts HTTP server automatically
- Provides terminal commands for each step
- Shows expected results
- Helps debug issues manually
- Educational for understanding the relay process

**Usage**:
```bash
node manual-test-guide.js
```

### 5. `http-test-server.js` - HTTP Test Server
**Purpose**: Dedicated HTTP server for testing relay functionality.

**Features**:
- Multiple endpoints: `/health`, `/echo`, `/large`, `/latency`
- Data integrity verification with hashes
- Request tracking and server identification
- Configurable port and mode

**Usage**:
```bash
node http-test-server.js [port] [mode] [serverId]
```

## Protocol Modes Tested

### TCP Protocol
- **Description**: Direct TCP tunnel through hyper-nat
- **Use Case**: Standard TCP applications, web servers, databases
- **Test Port**: 9000
- **Expected Behavior**: Low-latency, reliable connection

### UDP Protocol  
- **Description**: Direct UDP tunnel through hyper-nat
- **Use Case**: Gaming, video streaming, DNS queries
- **Test Port**: 9001
- **Expected Behavior**: Fast, connectionless communication

### TCPUDP Protocol
- **Description**: TCP-over-UDP tunnel (NEW FEATURE)
- **Use Case**: TCP apps over UDP networks, NAT traversal
- **Test Port**: 9002  
- **Expected Behavior**: TCP reliability with UDP transport

## Test Flow

1. **HTTP Server Setup**: Start test HTTP server on port 8888
2. **Direct Test**: Verify HTTP server responds correctly
3. **Relay Server**: Start hyper-nat server for target protocol
4. **Key Extraction**: Get public key from server output
5. **Relay Client**: Start hyper-nat client with extracted key
6. **Peer Discovery**: Wait for DHT peer discovery to complete
7. **Relay Test**: Send HTTP requests through the relay
8. **Data Integrity**: Verify response data matches request
9. **Cleanup**: Kill all processes and release ports

## Expected Results

### Successful Test Output
```
✅ Direct HTTP: SUCCESS (10ms)
✅ TCP relay: SUCCESS (25ms, overhead: 15ms)
✅ UDP relay: SUCCESS (22ms, overhead: 12ms)  
✅ TCPUDP relay: SUCCESS (28ms, overhead: 18ms)
✅ Data integrity: SUCCESS
🎉 ALL TESTS PASSED!
```

### Common Issues & Solutions

**"PEER_NOT_FOUND" Error**:
- **Cause**: DHT peer discovery taking longer than expected
- **Solution**: Increase wait times, check network connectivity

**"Connection Refused" Error**:
- **Cause**: Port already in use or process not ready
- **Solution**: Ensure cleanup between tests, check port availability

**"Timeout" Errors**:
- **Cause**: Processes taking longer to start than expected
- **Solution**: Increase timeout values, check system resources

## Manual Verification Commands

Test HTTP server directly:
```bash
curl http://127.0.0.1:8888/health
curl "http://127.0.0.1:8888/echo?data=test123"
```

Test through relay (replace 9000 with appropriate port):
```bash
curl http://127.0.0.1:9000/health
curl "http://127.0.0.1:9000/echo?data=relay-test"
```

## Report Files

Test runs generate JSON reports with detailed results:
- `final-relay-test-report-[UUID].json`
- `comprehensive-relay-test-report-[UUID].json`

These reports contain:
- Test metadata and timing
- Individual protocol results
- Error messages and debugging info
- Performance metrics

## Integration with CI/CD

For automated testing:
```bash
# Run tests with timeout
timeout 300 node final-relay-test.js

# Check exit code
if [ $? -eq 0 ]; then
    echo "All relay tests passed"
else
    echo "Some relay tests failed"
    exit 1
fi
```

## Development Notes

- All scripts follow the 200-line limit rule with proper separation
- Real HTTP requests are used throughout (no simulations)
- Proper process cleanup prevents port conflicts
- Retry logic handles network timing issues
- Comprehensive error handling and reporting
- Configuration over hardcoding for flexibility