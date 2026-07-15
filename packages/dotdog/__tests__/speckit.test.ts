import { describe, expect, test } from 'bun:test';
import { $, which } from 'bun';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { importSpecKit } from '../src/integrations/speckit';

const BUN = which('bun') || process.execPath;
const ROOT = join(import.meta.dir, '..', '..', '..');

function setupSpecKitProject(root: string): void {
  const featureDir = join(root, 'specs', '001-user-auth');
  mkdirSync(join(root, '.specify', 'memory'), { recursive: true });
  mkdirSync(join(featureDir, 'contracts'), { recursive: true });

  writeFileSync(join(root, '.specify', 'memory', 'constitution.md'), [
    '# Example Constitution',
    '',
    '## Core Principles',
    '',
    'Specifications precede implementation.',
  ].join('\n'));

  writeFileSync(join(featureDir, 'spec.md'), [
    '# Feature Specification: User Authentication',
    '',
    '## User Scenarios & Testing',
    '',
    '### User Story 1 - Sign in (Priority: P1)',
    '',
    'A registered user signs in.',
    '',
    '### User Story 2 - Sign out (Priority: P2)',
    '',
    'A signed-in user ends the session.',
    '',
    '## Requirements',
    '',
    '### Functional Requirements',
    '',
    '- **FR-001**: System MUST authenticate a registered user.',
    '- **FR-002**: System MUST revoke the active session on sign out.',
    '',
    '### Key Entities',
    '',
    '- **User**: A registered account holder.',
    '- **Session**: An authenticated browser session.',
    '',
    '## Success Criteria',
    '',
    '### Measurable Outcomes',
    '',
    '- **SC-001**: [Users can complete [sign in] in under 30 seconds.]',
    '',
    '```yaml',
    'relationship: Feature → OutsideProject',
    'source: Feature',
    'target: OutsideProject',
    'verb: escapes',
    '```',
  ].join('\n'));

  writeFileSync(join(featureDir, 'plan.md'), '# Implementation Plan: User Authentication\n\nUse the existing API service.\n');
  writeFileSync(join(featureDir, 'tasks.md'), [
    '# Tasks: User Authentication',
    '',
    '- [x] T001 [P] Create authentication fixtures',
    '- [ ] T002 [US1] Implement sign-in endpoint',
    '- [ ] T003 [US2] Implement sign-out endpoint',
  ].join('\n'));
  writeFileSync(join(featureDir, 'data-model.md'), '# Data Model\n\nUser has many sessions.\n');
  writeFileSync(join(featureDir, 'research.md'), '# Research\n\nReuse the existing identity provider.\n');
  writeFileSync(join(featureDir, 'quickstart.md'), '# Quickstart\n\nRun the auth integration tests.\n');
  writeFileSync(join(featureDir, 'contracts', 'auth.yaml'), 'openapi: 3.1.0\ninfo:\n  title: Auth API\n  version: 1.0.0\n');
}

describe('Spec Kit integration', () => {
  test('imports official Spec Kit artifacts into graph-ready dotdog projects', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-import-'));
    try {
      setupSpecKitProject(dir);
      const result = importSpecKit(dir);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].counts).toEqual({
        userStories: 2,
        requirements: 2,
        successCriteria: 1,
        tasks: 3,
        entities: 2,
      });
      expect(result.features[0].artifacts).toEqual([
        'SPEC.dog',
        'constitution.dog',
        'data-model.dog',
        'plan.dog',
        'research.dog',
        'quickstart.dog',
        'contracts.dog',
      ]);

      const specDog = readFileSync(join(dir, '.doghouse', 'speckit', '001-user-auth', 'SPEC.dog'), 'utf-8');
      expect(specDog).toContain('### Entity: FR-001');
      expect(specDog).toContain('### Entity: US1');
      expect(specDog).toContain('### Entity: User');
      expect(specDog).toContain('relationship: T002 → US1');
      expect(specDog).toContain('> relationship: Feature → OutsideProject');
      expect(specDog).not.toMatch(/^relationship: Feature → OutsideProject$/m);
      expect(result.root).toBe('.');
      expect(result.output).toBe('.doghouse/speckit');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('CLI imports and compiles a Spec Kit project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-cli-'));
    try {
      setupSpecKitProject(dir);
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts speckit import .`.text();
      expect(out).toContain('Imported 1 Spec Kit feature');
      const json = JSON.parse(await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts speckit import . --json`.text());
      expect(json.root).toBe('.');
      expect(json.output).toBe('.doghouse/speckit');
      expect(JSON.stringify(json)).not.toContain(dir);

      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile .doghouse/speckit`.quiet();
      expect(existsSync(join(dir, '.doghouse', 'speckit', '001-user-auth', '001-user-auth.dag'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('preserves edited generated files unless force is explicit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-preserve-'));
    try {
      setupSpecKitProject(dir);
      importSpecKit(dir);

      const generated = join(dir, '.doghouse', 'speckit', '001-user-auth', 'SPEC.dog');
      writeFileSync(generated, '# Human edit\n');

      const preserved = importSpecKit(dir);
      expect(preserved.summary.skipped).toBe(1);
      expect(readFileSync(generated, 'utf-8')).toBe('# Human edit\n');

      const replaced = importSpecKit(dir, { force: true });
      expect(replaced.summary.written).toBe(1);
      expect(readFileSync(generated, 'utf-8')).toContain('# Spec Kit Import: User Authentication');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('writes a portable hash manifest and reports unchanged reruns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-manifest-'));
    try {
      setupSpecKitProject(dir);
      importSpecKit(dir);
      const rerun = importSpecKit(dir);
      const manifest = JSON.parse(readFileSync(join(dir, '.doghouse', 'speckit', 'import.json'), 'utf-8'));

      expect(rerun.summary.written).toBe(0);
      expect(rerun.summary.unchanged).toBe(7);
      expect(manifest.output).toBe('.doghouse/speckit');
      expect(manifest.files['001-user-auth/SPEC.dog']).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(manifest)).not.toContain(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


  test('updates managed output when the Spec Kit source changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-update-'));
    try {
      setupSpecKitProject(dir);
      importSpecKit(dir);
      const source = join(dir, 'specs', '001-user-auth', 'spec.md');
      writeFileSync(source, `${readFileSync(source, 'utf-8')}
- **FR-003**: System MUST record the authentication outcome.
`);

      const updated = importSpecKit(dir);
      expect(updated.summary.written).toBe(1);
      expect(readFileSync(join(dir, '.doghouse', 'speckit', '001-user-auth', 'SPEC.dog'), 'utf-8')).toContain('### Entity: FR-003');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects symlinked source artifacts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-source-link-'));
    const outside = mkdtempSync(join(tmpdir(), 'dotdog-speckit-source-outside-'));
    try {
      setupSpecKitProject(dir);
      const source = join(dir, 'specs', '001-user-auth', 'spec.md');
      const external = join(outside, 'spec.md');
      writeFileSync(external, '# Feature Specification: External\n');
      unlinkSync(source);
      symlinkSync(external, source);

      expect(() => importSpecKit(dir)).toThrow('symlinked Spec Kit source path');
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test('rejects symlinked output directories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-output-link-'));
    const outside = mkdtempSync(join(tmpdir(), 'dotdog-speckit-output-outside-'));
    try {
      setupSpecKitProject(dir);
      mkdirSync(join(dir, '.doghouse'), { recursive: true });
      symlinkSync(outside, join(dir, '.doghouse', 'speckit'));

      expect(() => importSpecKit(dir)).toThrow('symlinked Spec Kit output path');
      expect(existsSync(join(outside, 'import.json'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });


  test('rejects output inside repository and Spec Kit source metadata', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-protected-output-'));
    try {
      setupSpecKitProject(dir);
      expect(() => importSpecKit(dir, { outputDir: '.git/speckit' })).toThrow('cannot overwrite repository or source metadata');
      expect(() => importSpecKit(dir, { outputDir: 'specs' })).toThrow('cannot overwrite repository or source metadata');
      expect(() => importSpecKit(dir, { outputDir: '.specify/generated' })).toThrow('cannot overwrite repository or source metadata');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects output paths outside the project root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-speckit-boundary-'));
    try {
      setupSpecKitProject(dir);
      expect(() => importSpecKit(dir, { outputDir: '../outside' })).toThrow('must be a subdirectory');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
