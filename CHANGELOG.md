# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- E2E test suite for critical path (QR → Backend → Device) with mocks
- Mock Server for E2E tests without external dependencies
- Mock WebSocket Gateway for IoT device simulation
- IoT E2E tests: CU-04, CU-09, CU-18
- Docker Compose for test environment
- GitHub Actions CI/CD pipeline
- Fly.io deployment configuration
- Backend Dockerfile for production
- System font fallback for mobile app
- Prometheus-compatible metrics endpoint (/health/metrics)
- Enhanced health checks with readiness probe
- Rate limiting guard for critical endpoints
- Rate limit configurations: CRITICAL, STANDARD, AUTH, READ
- Rate limiting E2E tests (CU-16: Fraud Detection)
- Payment gateway timeout simulation (CU-03)
- Orphaned lock cleanup mechanism
- Grafana dashboard JSON (smart-retail-main-dashboard.json)
- Deploy documentation (docs/DEPLOY.md)

### Changed
- Mobile app layout now supports system fonts as fallback
- Health controller now includes dependency checks
- Access controller now has rate limiting protection

## [0.1.0] - 2026-01-19

### Added - Week 1: Project Foundation
- Monorepo setup with pnpm workspaces and Turborepo
- NestJS backend with Hexagonal Architecture structure
- Domain entities: User, Device, Transaction, Product
- Value Objects: Money, TransactionStatus, DeviceStatus
- TypeORM integration with PostgreSQL
- Redis integration for caching and locks
- Environment configuration with validation

### Added - Week 2: Core Services
- Authentication module with JWT RS256
- Access Token (15min) and Refresh Token (7 days)
- Stock management service with Redis cache
- Distributed locks for race condition prevention
- Payment gateway abstraction (IPaymentGateway)
- MercadoPago adapter implementation
- MODO adapter (placeholder)
- WebSocket Gateway for IoT devices
- Swagger API documentation

### Added - Week 3: Critical Path Implementation
- ProcessAccessUseCase (CU-01 Happy Path)
- Insufficient balance handling (CU-02)
- Payment timeout handling (CU-03)
- Hardware failure refund (CU-04)
- Race condition prevention (CU-05)
- Stock lock expiration (CU-06)
- Offline fraud prevention (CU-07)
- QR replay attack prevention (CU-08)
- Unit tests for core use cases

### Added - Week 4: Mobile App
- React Native + Expo SDK 52+ project setup
- Expo Router file-based navigation
- Authentication flow (login, register, forgot-password)
- QR Scanner with react-native-vision-camera v4+
- Transaction history screen
- User profile screen
- Offline detection with NetInfo
- Auth context with SecureStore persistence
- Network provider for connectivity state
- Zustand store for access processing
- Axios API client with interceptors
- Design tokens and theme system
- UI components (Button, LoadingScreen, LoadingOverlay, OfflineBanner)

### Added - Week 4 Enhancements
- Offline queue service for failed requests
- Biometric authentication service
- Audio feedback service for kiosk mode
- Deep link handler for payment callbacks
- Payment result screen

### Added - Week 5: Integration & Testing
- E2E test configuration (Jest)
- Critical path integration tests
- Docker Compose for testing
- CI/CD pipeline (GitHub Actions)
- Fly.io deployment configuration
- Backend Dockerfile

### Fixed - Week 3 Review
- PaymentGatewayException constructor signature
- Device entity missing serialNumber field
- DeviceOrmEntity missing serialNumber column
- DeviceRepository missing interface methods
- TransactionRepository wrong ORM property names
- Enum type casting between domain and ORM

### Fixed - Week 4 Review
- Implicit 'any' types in React components
- Missing dependencies in package.json
- Missing auth screens (register, forgot-password)
- TypeScript configuration for Node types

## [0.0.1] - 2026-01-13

### Added
- Initial project setup
- SRS documentation (v5.5)
- AGENTS.md for AI guidance

---

[Unreleased]: https://github.com/your-org/smartRetail/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/smartRetail/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/your-org/smartRetail/releases/tag/v0.0.1
