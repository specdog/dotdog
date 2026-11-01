// AWS provider — read-only aws CLI metadata checks
// S3: aws s3api head-bucket
// Lambda: aws lambda get-function
// RDS: aws rds describe-db-instances
// Auth: AWS_PROFILE env var or ~/.aws/credentials (handled by aws CLI)

import { execFileSync } from 'child_process';
import { redactSecrets } from '../../workspace/redact';
import type { InfraResource, CheckResult, Provider } from './types';

function aws(args: string[]): { ok: boolean; output: string } {
  try {
    const result = execFileSync('aws', [...args, '--no-cli-pager', '--output', 'json'], {
      encoding: 'utf-8',
      timeout: 20000,
      env: { ...process.env },
    });
    return { ok: true, output: redactSecrets(result.trim()) };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = String(err.stdout || err.stderr || err.message || '');
    return { ok: false, output: redactSecrets(output) };
  }
}

function hasAwsCli(): boolean {
  try { execFileSync('aws', ['--version'], { encoding: 'utf-8', timeout: 5000 }); return true; } catch { return false; }
}

async function verifyResource(resource: InfraResource): Promise<CheckResult> {
  const separator = resource.resource.indexOf(':');
  const type = resource.resource.slice(0, separator), name = resource.resource.slice(separator + 1);
  if (separator < 1 || !name || name.startsWith('-') || /[\r\n]/.test(name) || (resource.region && !/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(resource.region))) {
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'Invalid resource format (expected type:name)' };
  }

  if (!hasAwsCli()) {
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'skip', message: 'aws CLI not installed' };
  }

  const regionArgs = resource.region ? ['--region', resource.region] : [];

  if (type === 's3') {
    // aws s3api head-bucket checks existence
    const { ok, output } = aws(['s3api', 'head-bucket', '--bucket', name, ...regionArgs]);
    if (ok) {
      return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: 'exists' };
    }
    if (output.includes('404') || output.includes('Not Found')) {
      return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'not found' };
    }
    // Might be a permissions issue
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'warn', message: `access denied or error: ${output.slice(0, 100)}` };
  }

  if (type === 'lambda') {
    const { ok, output } = aws(['lambda', 'get-function', '--function-name', name, ...regionArgs]);
    if (ok) {
      try {
        const d = JSON.parse(output);
        const runtime = d.Configuration?.Runtime || 'unknown';
        const updated = d.Configuration?.LastModified || '';
        return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: `exists (${runtime})`, detail: `updated: ${updated}` };
      } catch {
        return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: 'exists' };
      }
    }
    if (output.includes('Function not found')) {
      return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'not found' };
    }
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'warn', message: output.slice(0, 100) };
  }

  if (type === 'rds') {
    const { ok, output } = aws(['rds', 'describe-db-instances', '--db-instance-identifier', name, ...regionArgs]);
    if (ok) {
      try {
        const d = JSON.parse(output);
        const instances = d.DBInstances || [];
        const instance = instances[0];
        if (instance) {
          const status = instance.DBInstanceStatus || 'unknown';
          const engine = instance.Engine || '';
          return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: `${status} (${engine})`, detail: `endpoint: ${instance.Endpoint?.Address || 'N/A'}` };
        }
        return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'not found' };
      } catch {
        return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: 'exists' };
      }
    }
    if (output.includes('not found') || output.includes('DBInstanceNotFound')) {
      return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'not found' };
    }
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'warn', message: output.slice(0, 100) };
  }

  if (type === 'dynamodb') {
    const { ok, output } = aws(['dynamodb', 'describe-table', '--table-name', name, ...regionArgs]);
    if (ok) {
      try {
        const d = JSON.parse(output);
        const status = d.Table?.TableStatus || 'unknown';
        const items = d.Table?.ItemCount || 0;
        return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: `${status} (${items} items)` };
      } catch {
        return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: 'exists' };
      }
    }
    if (output.includes('ResourceNotFoundException')) {
      return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'not found' };
    }
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'warn', message: output.slice(0, 100) };
  }

  return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: `Unknown resource type: ${type}` };
}

export const awsProvider: Provider = {
  name: 'aws',
  verify: verifyResource,
};
