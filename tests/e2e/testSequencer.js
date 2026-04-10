/**
 * ============================================================================
 * SMART_RETAIL - E2E Test Sequencer
 * ============================================================================
 * Ordena los tests para ejecutar primero los más rápidos (con mocks).
 * ============================================================================
 */

const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Priorizar tests con mocks (más rápidos)
    return tests.sort((a, b) => {
      const aIsMocked = a.path.includes('mocked') || a.path.includes('iot-gateway');
      const bIsMocked = b.path.includes('mocked') || b.path.includes('iot-gateway');
      
      if (aIsMocked && !bIsMocked) return -1;
      if (!aIsMocked && bIsMocked) return 1;
      
      return a.path.localeCompare(b.path);
    });
  }
}

module.exports = CustomSequencer;
