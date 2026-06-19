// Provider types for infra-verify
// Each provider knows how to verify a cloud resource exists

export interface InfraResource {
  provider: string;       // cloudflare, supabase, vercel, netlify, railway, aws
  resource: string;       // e.g. "r2:avatars", "s3:uploads-prod", "project:my-app"
  entity: string;         // spec entity name this maps to
  region?: string;        // aws region, railway region, etc.
  tables?: string[];      // for supabase: table names to verify
}

export interface CheckResult {
  entity: string;
  provider: string;
  resource: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  detail?: string;        // extra info (object count, region, deploy URL, etc.)
  children?: CheckResult[]; // sub-checks (e.g. table checks within a supabase project)
}

export interface Provider {
  name: string;
  verify(resource: InfraResource): Promise<CheckResult>;
}

// Mask credential-like values for safe output
export function mask(s: string): string {
  if (!s) return '';
  if (s.length <= 8) return '***';
  return s.slice(0, 3) + '***' + s.slice(-3);
}
