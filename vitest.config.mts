import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic that can silently corrupt the content
// document or silently grant access: path parsing, patch application, op
// expansion, authorization, seed merging and the CAS decision. None of them
// import Next or R2, so no environment shims are needed.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
