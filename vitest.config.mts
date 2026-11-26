import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**', 'TripSpilter/**', 'temp_office_extract/**'],
    environment: 'node',
  },
});
