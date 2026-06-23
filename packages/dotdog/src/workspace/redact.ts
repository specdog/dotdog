const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[A-Za-z0-9_]{30,}/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /sk-[A-Za-z0-9_-]+/g,
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g,
  /\b(TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY)=([^\s]+)/gi,
];

export function redactSecrets(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, (_match, key) => key ? `${key}=[REDACTED]` : '[REDACTED]');
  return output;
}
