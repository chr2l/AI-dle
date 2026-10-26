import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['scripts/*.sim.ts'], testTimeout: 600_000 },
});
