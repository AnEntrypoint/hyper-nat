# Hyper-Nat Technical Documentation

## Architecture Overview
Hyper-Nat is a modern NAT traversal solution using hyperswarm DHT with a clean, modular architecture.

## Core Components

### Main Entry Points
- `index.js` - Application entry point, delegates to CLI
- `lib/cli.js` - Simplified CLI entry point (25 lines)

### Core Modules
- `lib/dht-relay.js` - Main DHT relay orchestrator (79 lines)
- `lib/config.js` - Configuration management (183 lines)
- `lib/modes.js` - Protocol mode handlers (57 lines)
- `lib/key-utils.js` - Cryptographic utilities (74 lines)

### Relay Modules (`lib/relays/`)
- `tcp-server.js` - TCP server relay implementation
- `tcp-client.js` - TCP client relay implementation  
- `udp-server.js` - UDP server relay implementation
- `udp-client.js` - UDP client relay implementation
- `tcpudp-server.js` - TCP-over-UDP server relay
- `tcpudp-client.js` - TCP-over-UDP client relay

### Utilities (`lib/utils/`)
- `logger.js` - Centralized logging system
- `config.js` - Configuration management utilities
- `base-handler.js` - Base connection handling class
- `error-handler.js` - Structured error handling
- `tcpudp-handlers.js` - TCP-UDP specific handlers

## Protocol Support
- **TCP**: Direct TCP connection relay
- **UDP**: UDP packet relay with connection tracking
- **TCP-UDP**: TCP connections tunneled over UDP packets

## Configuration
- Environment variables: LOG_LEVEL
- Default timeout: 15 seconds
- Default host: 127.0.0.1
- Validation: Port ranges, host formats, timeout values

## Error Handling
- Structured error types with context
- Recoverable error detection
- Centralized error logging
- Graceful degradation

## Current Status
- All files under 200 lines ✅
- No hardcoded values ✅
- Proper error handling ✅
- Modular architecture ✅
- Clean/DRY design ✅
