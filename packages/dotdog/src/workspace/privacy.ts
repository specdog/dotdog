const ALLOWED_PUBLIC_EXAMPLES = new Set([
  'example-org',
  'example-workspace',
  'example-service',
  'example-interface',
  'example-mobile',
  'example-worker',
  'example-ops',
  'core-flow',
  'billing',
  'catalog',
  'customer-portal',
  'admin-dashboard',
]);

export function isAllowedPublicExampleName(name: string): boolean {
  return ALLOWED_PUBLIC_EXAMPLES.has(name);
}

export function allowedPublicExampleNames(): string[] {
  return [...ALLOWED_PUBLIC_EXAMPLES].sort();
}
