// AWS provider — aws CLI + community MCP fallback
// S3: aws s3api head-bucket
// Lambda: aws lambda get-function
// RDS: aws rds describe-db-instances
// Auth: AWS_PROFILE env var or ~/.aws/credentials (handled by aws CLI)
// Community MCP: aws-s3-mcp (samuraikun/aws-s3-mcp)

import { execSync } from 'child_process';
import type { InfraResource, CheckResult, Provider } from './types';
import { connectStdio, type MCPConnection, type MCPTool } from '../mcp-client';

function aws(args: string): { ok: boolean; output: string } {
  try {
    const result = execSync(`aws ${args} --no-cli-pager --output json 2>&1`, {
      encoding: 'utf-8',
      timeout: 20000,
      env: { ...process.env },
    });
    return { ok: true, output: result.trim() };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = String(err.stdout || err.stderr || err.message || '');
    return { ok: false, output };
  }
}

function hasAwsCli(): boolean {
  try { execSync('which aws', { encoding: 'utf-8' }); return true; } catch { return false; }
}

async function verifyResource(resource: InfraResource): Promise<CheckResult> {
  const [type, name] = resource.resource.split(':');
  if (!type || !name) {
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'Invalid resource format (expected type:name)' };
  }

  if (!hasAwsCli()) {
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'skip', message: 'aws CLI not installed' };
  }

  const region = resource.region ? ` --region ${resource.region}` : '';

  if (type === 's3') {
    // aws s3api head-bucket checks existence
    const { ok, output } = aws(`s3api head-bucket --bucket ${name}${region}`);
    if (ok) {
      // Get approximate object count for detail
      let detail = '';
      try {
        const sizeResult = aws(`s3 ls --summarize --human-readable --recursive s3://${name}${region} 2>&1 | tail -3`);
        detail = sizeResult.output.replace(/\n/g, ' ').trim().slice(0, 120);
      } catch {}
      return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'pass', message: 'exists', detail };
    }
    if (output.includes('404') || output.includes('Not Found')) {
      return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'fail', message: 'not found' };
    }
    // Might be a permissions issue
    return { entity: resource.entity, provider: 'aws', resource: resource.resource, status: 'warn', message: `access denied or error: ${output.slice(0, 100)}` };
  }

  if (type === 'lambda') {
    const { ok, output } = aws(`lambda get-function --function-name ${name}${region}`);
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
    const { ok, output } = aws(`rds describe-db-instances --db-instance-identifier ${name}${region}`);
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
    const { ok, output } = aws(`dynamodb describe-table --table-name ${name}${region}`);
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
