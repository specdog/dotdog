import { describe, expect, test } from 'bun:test';
import { auditDesign } from '../src/design/audit';

describe('design audit', () => {
  test('reports actionable modeling gaps without inventing facts', () => {
    const report = auditDesign([3, 'example', [
      ['User', 'e', ['id', 's!'], ['active'], [['Order', 'owns']]],
      ['Order', 'e', [], [], []],
    ], {}], 'example', 'specs/example/example.dag');
    expect(report.entities).toBe(2);
    expect(report.relationships).toBe(1);
    expect(report.findings.some((finding) => finding.code === 'missing_identifier' && finding.entity === 'Order')).toBe(true);
    expect(report.findings.some((finding) => finding.code === 'missing_ownership' && finding.entity === 'User')).toBe(true);
    expect(report.findings.every((finding) => finding.nextStep.length > 0)).toBe(true);
  });

  test('flags a disconnected multi-entity model as high severity', () => {
    const report = auditDesign([3, 'example', [['User', 'e', [], [], []], ['Order', 'e', [], [], []]], {}], 'example', 'example.dag');
    expect(report.summary.high).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });
});
