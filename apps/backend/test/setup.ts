/**
 * ============================================================================
 * SMART_RETAIL - Jest Setup
 * ============================================================================
 * Configuración global que se ejecuta antes de cada test suite.
 * ============================================================================
 */

// Extend Jest matchers if needed
// import '@testing-library/jest-dom';

// Global test timeout
jest.setTimeout(5000);

// Mock console to reduce noise in tests (optional)
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global beforeAll hook
beforeAll(() => {
  // Setup that runs once before all tests
});

// Global afterAll hook
afterAll(() => {
  // Cleanup that runs once after all tests
});

// Global beforeEach hook
beforeEach(() => {
  // Reset any global state before each test
  jest.clearAllMocks();
});

// Global afterEach hook
afterEach(() => {
  // Cleanup after each test
});
