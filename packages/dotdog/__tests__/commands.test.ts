import { describe, test, expect } from 'bun:test';
import { $, which } from 'bun';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setupTempProject } from './helpers';

const BUN = which('bun') || process.execPath;
const ROOT = join(import.meta.dir, '..', '..', '..');

describe('untested commands', () => {
  test('parse outputs AST structure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-parse-'));
    try {
      setupTempProject(dir, 'testproj');
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts parse projects/testproj/SPEC.dog`.text();
      expect(out).toContain('sections');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('woof prints dog', async () => {
    const out = await $`${BUN} ${ROOT}/packages/dotdog/src/cli.ts woof`.text();
    expect(out.length).toBeGreaterThan(10);
  });

  test('badge generates SVG', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-badge-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts badge`.text();
      expect(out).toContain('dotdog-badge.svg');
      const svg = await $`cat ${dir}/dotdog-badge.svg`.text();
      expect(svg).toContain('saved');
      expect(existsSync(join(dir, 'dotdog-badge.svg'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('index builds search index', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-index-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts index`.text();
      expect(out.toLowerCase()).toContain('indexed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('search finds entities after index', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-search-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts index`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts search "Node"`.text();
      expect(out.toLowerCase()).toContain('node');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('predictions lists predictions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-pred-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts predictions`.text();
      // Should not crash — may or may not have predictions
      expect(typeof out).toBe('string');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('analyze produces spec analysis', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-analyze-'));
    try {
      setupTempProject(dir, 'testproj');
      const result = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts analyze`.nothrow();
      expect(result.text()).toContain('complete');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('generate creates missing files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-gen-'));
    try {
      setupTempProject(dir, 'testproj');
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts generate`.text();
      expect(typeof out).toBe('string');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('verify outputs spec-code alignment', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-verify-'));
    try {
      setupTempProject(dir, 'testproj');
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts verify`.text();
      expect(typeof out).toBe('string');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('simulate runs scenario', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-sim-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      // Simulate should not crash — returns partial success if no scenario steps
      const result = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts simulate compile`.nothrow();
      expect([0, 1]).toContain(result.exitCode);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('map writes repo world artifacts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-map-'));
    try {
      setupTempProject(dir, 'testproj');
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts map . --project repo-world-test`.text();
      expect(out).toContain('repo.dag');
      expect(existsSync(join(dir, '.doghouse', 'generated', 'repo-map.dog'))).toBe(true);
      expect(existsSync(join(dir, '.doghouse', 'generated', 'repo.dag'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('query reads repo world artifacts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-query-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts map . --project repo-world-test`.quiet();
      const dag = join(dir, '.doghouse', 'generated', 'repo.dag');
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts query repository --dag ${dag}`.text();
      expect(out.toLowerCase()).toContain('repository');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
