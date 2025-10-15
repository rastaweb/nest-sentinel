# @rastaweb/sentinel - Developer Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Core Features](#core-features)
3. [Architecture & Structure](#architecture--structure)
4. [Technical Concepts](#technical-concepts)
5. [API Reference](#api-reference)
6. [Testing Overview](#testing-overview)
7. [Development Setup](#development-setup)
8. [Design Patterns](#design-patterns)
9. [Roadmap & Extensions](#roadmap--extensions)

---

## 🧱 Project Overview

### What it Solves

`@rastaweb/sentinel` is a production-ready NestJS library that provides comprehensive security and monitoring capabilities for microservice architectures. It solves critical problems in service-to-service communication:

- **Authentication Gap**: Securing API endpoints between internal services
- **Traffic Visibility**: Understanding request patterns and system usage
- **Access Control**: Fine-grained permission management based on IP, MAC, and API keys
- **Audit Trail**: Complete logging of access attempts and traffic patterns

### How it Works Conceptually

The library operates as a **layered security system**:

1. **Guard Layer**: Intercepts incoming requests and evaluates access rules
2. **Service Layer**: Manages API keys, validates credentials, and logs events
3. **Persistence Layer**: Stores access logs, events, and API key metadata
4. **Client Layer**: Provides SDK for consuming protected services

### NestJS Integration

The library integrates seamlessly into any NestJS application as a **global module**:

```typescript
import { ApiKey, TrafficLog, AccessEvent } from "@rastaweb/sentinel";

@Module({
  imports: [
    // Configure TypeORM with Sentinel entities
    TypeOrmModule.forRoot({
      type: "sqlite",
      database: "./security.db",
      entities: [
        __dirname + "/**/*.entity{.ts,.js}",
        ApiKey,
        TrafficLog,
        AccessEvent,
      ],
      synchronize: true,
    }),

    // Configure Sentinel
    SentinelModule.register({
      enableLogs: true,
      globalPolicy: {
        ipWhitelist: ["10.0.0.0/8"],
        requireApiKey: true,
      },
    }),
  ],
})
export class AppModule {}
```

### Real-World Scenarios

- **Microservice Mesh**: Secure communication between 20+ internal services
- **Partner API**: Controlled access for external integrations with rate limiting
- **Internal Tools**: Admin dashboards with IP-based access controls
- **IoT Platform**: Device authentication with MAC address validation
- **Financial Services**: Audit-compliant transaction logging and access control

---

## 🔧 Core Features

### 1. API Key Authentication

**Purpose**: Secure service-to-service authentication with scope-based permissions.

**How it Works**:

- Generates cryptographically secure API keys with bcrypt hashing
- Supports expiration dates and automatic key rotation
- Scope-based access control (e.g., `['read', 'write', 'admin']`)
- Owner-based organization (`user` vs `service` owners)

**Extension Points**:

- Custom scope validation logic
- Integration with external auth providers
- Key rotation policies

### 2. Multi-Level Access Control

**Purpose**: Flexible, rule-based access control supporting multiple criteria.

**Capabilities**:

- **IP-based**: CIDR ranges, exact matches, or wildcard (`*`)
- **MAC-based**: Hardware address validation
- **Combined Rules**: Require multiple criteria (IP + API key + MAC)
- **Allow/Deny Lists**: Precedence-based rule evaluation

**Rule Examples**:

```typescript
@AccessRule({
  allow: ['192.168.1.0/24', 'MAC:00-14-22-01-23-45'],
  deny: ['192.168.1.100'],
  require: { apiKey: true, scopes: ['admin'] }
})
@Get('/admin')
adminEndpoint() {}
```

### 3. Traffic Monitoring & Analytics

**Purpose**: Comprehensive request logging and traffic analysis.

**Data Captured**:

- Request metadata (method, path, duration, status)
- Client information (IP, MAC address, geolocation)
- Authentication context (API key, user/service ID)
- Performance metrics (response time, payload size)

**Analytics Features**:

- Traffic pattern analysis
- Performance bottleneck identification
- Security incident detection
- Retention management (automatic cleanup)

### 4. Database Agnostic Design

**Supported Databases**:

- **SQLite**: Development and small deployments
- **MySQL**: Production web applications (improved compatibility v1.1.0+)
- **PostgreSQL**: Enterprise applications with complex queries

**Configuration** (v1.1.0+):

```typescript
// Use your main TypeORM configuration
TypeOrmModule.forRoot({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'user',
  password: 'pass',
  database: 'myapp',
  entities: [
    __dirname + '/**/*.entity{.ts,.js}',
    ApiKey, TrafficLog, AccessEvent, // Add Sentinel entities
  ],
}),
}
```

### 5. CLI Management Tools

**Commands Available**:

```bash
# Initialize database
sentinel init-db --url sqlite://./db.sqlite

# Create API keys
sentinel create-key --owner-type service --owner-id payment-service

# List keys
sentinel list-keys --owner-type service

# Revoke keys
sentinel revoke-key --key-id abc123
```

### 6. HTTP Client SDK

**Purpose**: Simplified consumption of protected APIs with automatic retries.

**Features**:

- Automatic API key injection
- Configurable retry logic with exponential backoff
- Request/response logging
- Error handling and circuit breaker patterns

---

## 🏗️ Architecture & Structure

### Folder Structure

```
src/
├── sentinel.module.ts    # Main module with DI configuration
├── index.ts                    # Public API exports
├── cli/                        # Command-line tools
│   └── index.ts               # CLI commands and database utilities
├── client/                     # HTTP client SDK
│   └── index.ts               # SentinelClient class
├── decorators/                 # Access control decorators
│   └── access-rule.decorator.ts
├── entities/                   # TypeORM database entities
│   ├── api-key.entity.ts      # API key storage
│   ├── traffic-log.entity.ts  # Request logging
│   ├── access-event.entity.ts # Security events
│   └── index.ts
├── guards/                     # NestJS request guards
│   └── access.guard.ts        # Main access control logic
├── interceptors/               # NestJS interceptors
│   └── track-traffic.interceptor.ts # Request logging
├── interfaces/                 # TypeScript type definitions
│   └── index.ts               # All interfaces and constants
├── services/                   # Business logic services
│   ├── api-key.service.ts     # API key management
│   ├── traffic.service.ts     # Traffic logging and analytics
│   └── __tests__/             # Service unit tests
├── utils/                      # Utility functions
│   ├── network.util.ts        # IP/MAC address handling
│   └── network.util.spec.ts   # Utility tests
```

### Component Interaction Flow

```
Request → AccessGuard → TrafficInterceptor → Controller
    ↓         ↓              ↓
    ↓    ApiKeyService   TrafficService
    ↓         ↓              ↓
Database ←────┴──────────────┘
```

### Dependency Injection Architecture

The library uses NestJS's dependency injection system with several key patterns:

1. **Global Module**: All services are exported globally for easy consumption
2. **Symbol-based Tokens**: Configuration injection using `ACCESS_TRAFFIC_OPTIONS`
3. **Repository Pattern**: TypeORM repositories for data persistence
4. **Service Layer**: Business logic separation from controllers

---

## 🧠 Technical Concepts

### Request Processing Flow

```
1. Request arrives at NestJS application
2. AccessGuard.canActivate() is triggered
   ├── Parse client IP (considering proxy headers)
   ├── Extract MAC address from custom headers
   ├── Evaluate access rules (deny → allow → requirements)
   ├── Validate API key if required
   └── Log access decision to database
3. If allowed, TrackTrafficInterceptor logs request details
4. Request proceeds to controller
5. Response interceptor logs completion details
```

### Access Rule Evaluation Logic

The access control follows a **precedence-based evaluation**:

1. **IP Version Check**: Reject if wrong IP version (IPv4/IPv6)
2. **Deny Rules**: Check deny list first (highest precedence)
3. **Allow Rules**: If allow list exists, IP must match
4. **API Key Validation**: Verify key existence, expiration, and scopes
5. **Combined Requirements**: All specified requirements must be met

### API Key Security Model

**Key Generation**:

```typescript
// Generate 32-byte random key
const rawKey = crypto.randomBytes(32).toString("hex");

// Hash with bcrypt (cost factor 12)
const hashedKey = await bcrypt.hash(rawKey, 12);
```

**Key Validation**:

```typescript
// Time-constant comparison prevents timing attacks
const isValid = await bcrypt.compare(providedKey, storedHash);

// Additional checks: expiration, active status, scopes
```

### Traffic Logging Architecture

The system uses an **asynchronous queue-based logging** approach:

1. **Request Queue**: Incoming requests are queued for background processing
2. **Batch Processing**: Logs are processed in batches every 5 seconds
3. **Timer Management**: Proper cleanup prevents memory leaks during testing
4. **Retention Policy**: Automatic cleanup of old logs based on configured retention period

### Network Utility Functions

**IP Address Handling**:

- Supports both IPv4 and IPv6 addresses
- CIDR range matching for subnets
- Proxy header parsing (`X-Forwarded-For`, `X-Real-IP`)
- IPv4-mapped IPv6 address normalization

**MAC Address Processing**:

- Normalizes different formats (`:`, `-`, `.` separators)
- Case-insensitive matching
- Validation and formatting utilities

---

## 📚 API Reference

### Module Configuration

```typescript
interface SentinelOptions {
  dbUrl?: string; // Database connection URL
  autoMigrate?: boolean; // Auto-create tables
  enableLogs?: boolean; // Enable request logging
  globalPolicy?: AccessPolicy; // Default access rules
  apiKeyHeader?: string; // API key header name
  clientMacHeader?: string; // MAC address header name
  trustProxy?: boolean; // Trust proxy headers
  trafficRetentionDays?: number; // Log retention period
  serviceAuth?: {
    // Service authentication config
    enabled: boolean;
    requiredScopes?: string[];
  };
  identifyUserFromRequest?: (req) => Promise<{ userId?; serviceId? }>;
}
```

### Decorators

```typescript
// Basic access control
@AccessRule({
  allow: ['192.168.1.0/24'],
  deny: ['192.168.1.100'],
  require: { apiKey: true, scopes: ['admin'] }
})

// Convenience decorators
@RequireApiKey(['read', 'write'])
@AllowIps(['10.0.0.0/8'])
@DenyIps(['192.168.1.100'])
@IPv4Only()
@IPv6Only()
```

### Services

#### ApiKeyService

```typescript
class ApiKeyService {
  // Create new API key
  async createKey(
    ownerType,
    ownerId,
    scopes?,
    name?,
    expiresAt?
  ): Promise<{ apiKey; rawKey }>;

  // Validate API key
  async validateKey(key, requiredScope?): Promise<ValidationResult>;

  // Revoke API key
  async revokeKey(keyId): Promise<void>;

  // List keys for owner
  async listKeysForOwner(ownerType, ownerId): Promise<ApiKeyRecord[]>;
}
```

#### TrafficService

```typescript
class TrafficService {
  // Log request
  async logRequest(logData: TrafficLogData): Promise<void>;

  // Log access event
  async logAccessEvent(
    decision,
    reason,
    ip,
    clientMac?,
    apiKeyId?,
    ruleMeta?
  ): Promise<void>;

  // Query logs
  async queryLogs(options: QueryLogsOptions): Promise<TrafficLog[]>;

  // Get statistics
  async getTrafficStats(since?: Date): Promise<any>;

  // Clean up old logs
  async cleanupOldLogs(): Promise<void>;
}
```

### Client SDK

```typescript
class SentinelClient {
  constructor(options: ClientOptions);

  // HTTP methods with automatic retries
  async get(url, config?): Promise<any>;
  async post(url, data?, config?): Promise<any>;
  async put(url, data?, config?): Promise<any>;
  async delete(url, config?): Promise<any>;

  // Update API key
  setApiKey(apiKey: string): void;
}
```

---

## 🧪 Testing Overview

### Test Structure

The library follows a comprehensive testing strategy with **100% test coverage**:

```
src/
├── services/__tests__/
│   ├── api-key.service.spec.ts      # 15 test cases
│   └── traffic.service.spec.ts      # 9 test cases
└── utils/
    └── network.util.spec.ts         # 7 test cases
```

### Testing Patterns

#### 1. Service Unit Tests

- **Mocking Strategy**: Full repository mocking using Jest
- **Dependency Injection**: Proper NestJS testing module setup
- **Isolation**: Each test is independent with fresh mocks

#### 2. Integration Testing

- **Database Testing**: In-memory SQLite for fast execution
- **Timer Management**: Proper cleanup to prevent test hanging
- **Async Operations**: Comprehensive Promise and callback testing

#### 3. Utility Testing

- **Pure Functions**: Network utilities with deterministic outputs
- **Edge Cases**: Invalid inputs, malformed data, boundary conditions
- **Cross-Platform**: IP and MAC address format variations

### Jest Configuration

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "testEnvironment": "node",
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage"
}
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:cov
```

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js**: >=16.0.0
- **TypeScript**: ^5.0.0
- **NestJS**: ^10.0.0

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sentinel

# Install dependencies
npm install

# Install peer dependencies for development
npm install @nestjs/common@^10.0.0 @nestjs/core@^10.0.0
```

### Development Workflow

```bash
# Type checking
npm run typecheck

# Build the library
npm run build

# Watch mode for development
npm run build:watch

# Run tests
npm test

# Lint and fix code
npm run lint

# Clean build artifacts
npm run clean
```

### Database Setup

```bash
# Initialize development database
npm run cli init-db --url sqlite://./dev.db

# Create test API key
npm run cli create-key --owner-type service --owner-id test-service
```

### Publishing to NPM

```bash
# Prepare for publication (runs clean + build)
npm run prepublishOnly

# Publish to npm (requires authentication)
npm publish
```

### Development Database

For development, use SQLite with the CLI:

```bash
# Initialize database
./dist/cli/index.js init-db --url sqlite://./development.db

# Create development API key
./dist/cli/index.js create-key \
  --owner-type service \
  --owner-id dev-service \
  --name "Development Key" \
  --scopes read,write
```

---

## 🎨 Design Patterns

### 1. **Dependency Injection Pattern**

- **Implementation**: NestJS DI container with Symbol-based tokens
- **Benefits**: Loose coupling, testability, configuration flexibility
- **Usage**: Services, guards, interceptors all use constructor injection

### 2. **Repository Pattern**

- **Implementation**: TypeORM repositories for data access
- **Benefits**: Database abstraction, query optimization, migration support
- **Usage**: ApiKeyService and TrafficService use repositories

### 3. **Decorator Pattern**

- **Implementation**: NestJS decorators for access control
- **Benefits**: Declarative security, method-level granularity, composability
- **Usage**: `@AccessRule()`, `@RequireApiKey()`, etc.

### 4. **Guard Pattern**

- **Implementation**: NestJS CanActivate interface
- **Benefits**: Request interception, centralized security logic
- **Usage**: AccessGuard validates all protected routes

### 5. **Interceptor Pattern**

- **Implementation**: NestJS NestInterceptor interface
- **Benefits**: Cross-cutting concerns, request/response transformation
- **Usage**: TrackTrafficInterceptor for logging

### 6. **Strategy Pattern**

- **Implementation**: Different database configurations
- **Benefits**: Runtime database selection, environment-specific configs
- **Usage**: SQLite for dev, MySQL/PostgreSQL for production

### 7. **Queue Pattern**

- **Implementation**: In-memory queues for async processing
- **Benefits**: Non-blocking request handling, batch processing efficiency
- **Usage**: Traffic logging and access event processing

### 8. **Factory Pattern**

- **Implementation**: Dynamic module creation
- **Benefits**: Configuration-based instantiation, async setup support
- **Usage**: SentinelModule.register() and registerAsync()

---

## 🗺️ Roadmap & Extensions

### Planned Features

1. **Rate Limiting**
   - Token bucket algorithm implementation
   - Per-IP and per-API-key rate limits
   - Redis-based distributed rate limiting

2. **Enhanced Analytics**
   - Real-time dashboard integration
   - Traffic pattern anomaly detection
   - Performance bottleneck identification

3. **Security Enhancements**
   - IP geolocation integration
   - Threat intelligence feeds
   - Automatic IP blocking for suspicious activity

4. **Cloud Integration**
   - AWS CloudWatch metrics
   - Azure Monitor integration
   - Google Cloud Logging support

### Extension Points

#### Custom Access Rules

```typescript
// Extend AccessRuleOptions interface
interface CustomAccessRuleOptions extends AccessRuleOptions {
  geoLocation?: {
    allowedCountries: string[];
    deniedCountries: string[];
  };
}
```

#### Custom Client Identification

```typescript
// Implement custom identification logic
const options: SentinelOptions = {
  identifyUserFromRequest: async (req) => {
    const jwtToken = req.headers.authorization;
    const decoded = jwt.verify(jwtToken, secret);
    return { userId: decoded.sub, serviceId: decoded.service };
  },
};
```

#### Plugin Architecture

The library is designed to support plugins for:

- Custom authentication providers
- External logging systems
- Metrics collection backends
- Alert notification systems

### Contributing Guidelines

1. **Code Quality**: Maintain 100% test coverage
2. **TypeScript**: Strict typing, no `any` types
3. **Documentation**: Update docs for all public API changes
4. **Backwards Compatibility**: Follow semantic versioning
5. **Performance**: Benchmark critical paths, async-first design

### Architecture Evolution

The library is designed with future scalability in mind:

- **Microservice Ready**: Stateless design for horizontal scaling
- **Event-Driven**: Easy integration with message queues
- **Plugin System**: Extensible without core modifications
- **Multi-Tenant**: Owner-based isolation for SaaS applications

---

## 📝 License & Support

- **License**: MIT License
- **Author**: Rastaweb
- **Repository**: [GitHub Repository](https://github.com/alwase-blue/docker-engine.git)
- **Issues**: GitHub Issues for bug reports and feature requests
- **Documentation**: This file serves as the complete developer guide

---

_This documentation reflects the current state of @rastaweb/sentinel v1.0.2. For the most up-to-date information, please refer to the repository and test files._
