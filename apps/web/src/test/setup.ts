import '@testing-library/jest-dom/vitest';
import { afterAll, beforeAll } from 'vitest';

// Silence volontaire : dans les tests, les appels console.error de React
// sont attendus (invariants) et ne doivent pas polluer le rapport final.
const originalError = globalThis.console.error;
beforeAll(() => {
  globalThis.console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.startsWith('Warning: ReactDOMTestUtils.act')) return;
    originalError(...args);
  };
});
afterAll(() => {
  globalThis.console.error = originalError;
});