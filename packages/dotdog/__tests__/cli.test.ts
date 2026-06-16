import { describe, test, expect } from 'bun:test';
import { $, which } from 'bun';

const BUN = which('bun') || process.execPath;

describe('CLI', () => {
  test('--version', async () => {
    const out = await $`${BUN} packages/dotdog/src/cli.ts --version`.text();
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('validate exits 0', async () => {
    const result = await $`${BUN} packages/dotdog/src/cli.ts validate`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('list shows spec-platform', async () => {
    const out = await $`${BUN} packages/dotdog/src/cli.ts list`.text();
    expect(out).toContain('spec-platform');
  });

  test('visualize snapshot', async () => {
    // Ensure .dag is compiled first
    await $`${BUN} packages/dotdog/src/cli.ts compile`.quiet();
    const out = await $`${BUN} packages/dotdog/src/cli.ts visualize`.text();
    expect(out).toMatchSnapshot();
  });
});
