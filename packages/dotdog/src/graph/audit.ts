import { createHash } from 'crypto';
import { resolveUserPath, isIgnoredRepoPath } from '../workspace/paths';
import { statSync, readFileSync } from 'fs';
import { isAbsolute } from 'path';
import type { NormalizedGraph } from './model';

export function auditGraph(graph: NormalizedGraph, root: string, options: { profile?: string; maxAgeDays?: number; now?: number } = {}) {
  const profile = options.profile || 'evidence', maxAgeDays = options.maxAgeDays ?? 30, now = options.now ?? Date.now();
  if (!['evidence', 'embodied'].includes(profile)) throw new Error('profile must be evidence or embodied');
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0 || maxAgeDays > 36500) throw new Error('max-age-days must be greater than zero and at most 36500');
  const findings: { node: string; code: string; message: string }[] = [];
  const add = (node: string, code: string, message: string) => findings.push({ node, code, message });
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const evidence = graph.nodes.filter(node => node.kind === 'evidence');
  const validEvidence = new Set<string>();
  for (const node of evidence) {
    const before = findings.length, properties = node.properties;
    const observedAt = typeof properties.observedAt === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(properties.observedAt) ? Date.parse(properties.observedAt) : NaN;
    if (!Number.isFinite(observedAt) || observedAt > now) add(node.id, 'invalid_time', 'Evidence needs a valid, non-future observedAt timestamp with timezone');
    else if (now - observedAt > maxAgeDays * 86400000) add(node.id, 'stale_evidence', 'Evidence is older than the requested freshness window');
    if (properties.result !== 'pass') add(node.id, 'unconfirmed_evidence', 'Evidence result is not pass');
    try {
      if (typeof properties.file !== 'string' || isAbsolute(properties.file) || isIgnoredRepoPath(properties.file)) throw new Error('Evidence needs a non-secret repository-relative file');
      if (typeof properties.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(properties.sha256)) throw new Error('Evidence needs a SHA-256 digest');
      const file = resolveUserPath(properties.file, root);
      if (statSync(file).size > 32 * 1024 * 1024) throw new Error('Evidence artifact exceeds 32 MiB');
      if (createHash('sha256').update(readFileSync(file)).digest('hex') !== properties.sha256.toLowerCase()) throw new Error('Evidence file digest changed');
    } catch (error) { add(node.id, 'invalid_artifact', error instanceof Error ? error.message : String(error)); }
    if (findings.length === before) validEvidence.add(node.id);
  }
  if (!evidence.length) add('', 'no_evidence', 'No evidence nodes were supplied');
  const linked = (node: string, verb: string, kind: string, valid?: Set<string>) => graph.edges.some(edge => edge.sourceId === node && edge.verb === verb && byId.get(edge.targetId)?.kind === kind && (!valid || valid.has(edge.targetId)));
  if (profile === 'embodied') {
    for (const kind of ['asset', 'requirement']) if (!graph.nodes.some(node => node.kind === kind)) add('', 'missing_kind', `Embodied profile needs at least one ${kind}`);
    for (const node of graph.nodes) {
      if (node.kind === 'requirement') {
        if (!linked(node.id, 'verified_by', 'evidence', validEvidence)) add(node.id, 'unverified_requirement', 'Requirement needs verified_by fresh passing evidence');
        if (!linked(node.id, 'applies_to', 'asset') && !linked(node.id, 'applies_to', 'sensor') && !linked(node.id, 'applies_to', 'actuator')) add(node.id, 'unscoped_requirement', 'Requirement needs applies_to an asset, sensor or actuator');
      }
      if (node.kind === 'sensor' && !linked(node.id, 'calibrated_by', 'evidence', validEvidence)) add(node.id, 'unverified_calibration', 'Sensor needs calibrated_by fresh passing evidence');
      if (node.kind === 'actuator' && !linked(node.id, 'constrained_by', 'requirement')) add(node.id, 'unconstrained_actuator', 'Actuator needs constrained_by a requirement');
      if (node.kind === 'hazard' && !linked(node.id, 'mitigated_by', 'requirement')) add(node.id, 'unmapped_hazard', 'Hazard needs mitigated_by a requirement');
    }
  }
  return { ok: findings.length === 0, profile, nodes: graph.nodes.length, evidence: evidence.length, validEvidence: validEvidence.size, findings, limitations: [
    'Advisory graph/evidence coverage only. Not a safety assessment, certification, permission to actuate, or proof of a physical-system property.',
    'Digests establish file identity, not truth or authenticity. Coverage is limited to supplied nodes; omitted assets and hazards cannot be discovered.',
    'No ROS/DDS connection, USD validation, device operation, or execution of evidence files.',
  ] };
}
