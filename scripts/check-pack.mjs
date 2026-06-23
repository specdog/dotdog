import { execFileSync } from 'node:child_process';

const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: 'packages/dotdog',
  encoding: 'utf8',
});

const result = JSON.parse(raw)[0];
const files = result.files.map((file) => file.path);
const forbidden = [
  /^node_modules\//,
  /^__tests__\//,
  /^fixtures\//,
  /^agent-bench\//,
  /^\.env/,
  /private/i,
  /customer-name/i,
  /internal-codename/i,
];

const violations = files.filter((file) => forbidden.some((pattern) => pattern.test(file)));
if (violations.length) {
  console.error('Forbidden files in dotdog package:');
  for (const file of violations) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`Package check passed: ${files.length} files`);
