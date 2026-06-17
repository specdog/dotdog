import { describe, test, expect } from 'bun:test';
import { $, which } from 'bun';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { setupTempProject } from './helpers';

const BUN = which('bun') || process.execPath;
const ROOT = join(dirname(import.meta.dir), '..', '..');

describe('regression', () => {
  test('resolve only modifies targeted prediction', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-resolve-'));
    try {
      const projectDir = join(dir, 'projects', 'testproj');
      mkdirSync(projectDir, { recursive: true });

      const spec = [
        '## Product',
        '',
        '### Prediction: Market grows',
        '',
        '```yaml',
        'trigger: new regulation',
        'timeframe: 6 months',
        'confidence: 85',
        'status: pending',
        '```',
        '',
        '### Prediction: Competitor fails',
        '',
        '```yaml',
        'trigger: bad quarter',
        'timeframe: 3 months',
        'confidence: 60',
        'status: pending',
        '```',
      ].join('\n');

      writeFileSync(join(projectDir, 'SPEC.dog'), spec);

      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts resolve "Market grows" --correct`.quiet();

      const modified = readFileSync(join(projectDir, 'SPEC.dog'), 'utf-8');
      expect(modified).toContain('status: correct');
      const competitorBlock = modified.substring(modified.indexOf('Competitor fails'));
      expect(competitorBlock).not.toContain('status: correct');
      expect(competitorBlock).toContain('status: pending');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('staleness handles missing package.json gracefully', async () => {
    const result = await $`cd ${ROOT} && ${BUN} packages/dotdog/src/cli.ts staleness`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('visualize outputs mermaid graph with nodes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-viz-reg-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts visualize`.text();
      expect(out).toContain('[');
      expect(out).toContain(']');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
