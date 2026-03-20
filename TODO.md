# Hyper-Nat Codebase Cleanup TODO

## CRITICAL ISSUES (Fix First)

### 1. Split Large Files (200+ lines rule)
- [x] lib/dht-relay.js (574 lines) → split into multiple modules
  - [x] Extract TCP server functionality (lines ~42-148)
  - [x] Extract TCP client functionality (lines ~149-205) 
  - [x] Extract UDP server functionality (lines ~199-292)
  - [x] Extract TCP-UDP server functionality (lines ~293-445)
  - [x] Extract TCP-UDP client functionality (lines ~446-567)
- [x] lib/cli.js (219 lines) → split into CLI and argument parsing

### 2. Remove Excessive Logging
- [ ] lib/dht-relay.js: 59 console.log calls → reduce to essential debugging
- [ ] lib/cli.js: 8 console.log calls → reduce to user-facing messages only
- [ ] lib/config.js: 4 console.log calls → replace with proper error handling
- [ ] lib/modes.js: 3 console.log calls → replace with proper logging

### 3. Code Deduplication
- [x] Consolidate socket.on patterns (12 occurrences)
- [x] Consolidate conn.on patterns (12 occurrences)
- [x] Extract common connection handling logic
- [x] Unify error handling patterns

## STRUCTURAL IMPROVEMENTS

### 4. Extract Common Patterns
- [x] Create base connection handler class
- [x] Extract timeout handling (currently 15 second hardcoded)
- [x] Extract cleanup functions (multiple similar implementations)
- [x] Create unified error handling system

### 5. Improve Error Handling
- [ ] Replace all console.error with proper error objects
- [ ] Add specific error types for different failure modes
- [ ] Implement proper error propagation
- [ ] Add connection timeout handling

### 6. Configuration Management
- [x] Extract hardcoded values (ports, timeouts, hosts)
- [x] Centralize protocol-specific configurations
- [x] Add validation for configuration parameters

## CODE QUALITY

### 7. Function Complexity Reduction
- [ ] Break down createTcpClient (99 lines)
- [ ] Break down createTcpUdpClient (93 lines)
- [ ] Break down createTcpUdpServer (58 lines)
- [ ] Break down setupTcpUdpSocketHandlers (61 lines)
- [ ] Break down setupTcpUdpClientHandlers (58 lines)

### 8. Parameter Reduction
- [ ] Reduce createTcpClient parameters (14 params)
- [ ] Reduce createTcpServer parameters (9 params)
- [ ] Reduce createTcpUdpClient parameters (9 params)
- [ ] Reduce createUdpServer parameters (8 params)

### 9. Remove Dead Code
- [ ] Check for unused imports
- [ ] Remove unreachable code paths
- [ ] Clean up temporary debugging code

## TESTING & VALIDATION

### 10. Validation
- [ ] Test all protocol combinations (TCP, UDP, TCP-UDP)
- [ ] Test multi-port configurations
- [ ] Test configuration file loading
- [ ] Test error scenarios and recovery

### 11. Documentation
- [ ] Update inline documentation after refactoring
- [ ] Add API documentation for extracted modules
- [ ] Update README with new structure
- [ ] Add usage examples for all protocols

## DEPLOYMENT

### 12. Final Checks
- [ ] Ensure package.json start script works
- [ ] Verify build process (nexe) still works
- [ ] Test all CLI arguments and options
- [ ] Validate all exported modules

## CLEANUP RULES COMPLIANCE

- [ ] All files under 200 lines
- [ ] No hardcoded values
- [ ] Proper error handling without fallbacks
- [ ] No temporary/debug code
- [ ] Dynamic and modular code only
- [ ] Single implementations (no duplicates)
- [ ] Clean/DRY/generalized architecture
