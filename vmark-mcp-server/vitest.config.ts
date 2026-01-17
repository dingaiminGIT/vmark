import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts',
        'src/types.ts',           // Type definitions only
        'src/bridge/types.ts',    // Type definitions only
      ],
      thresholds: {
        statements: 90,
        branches: 70,  // Branch coverage is harder with error handling
        functions: 90,
        lines: 90,
      },
    },
  },
});
