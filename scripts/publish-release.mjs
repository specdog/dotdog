import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { npm } from './lib/npm.mjs';

const file = resolve(process.argv[2] || 'release.json');
const manifest = JSON.parse(readFileSync(file, 'utf8'));
const version = JSON.parse(readFileSync('packages/dotdog/package.json', 'utf8')).version;
assert.equal(manifest.verified, true);
assert.equal(manifest.version, version);
assert.equal(manifest.artifact, basename(manifest.artifact));
assert.equal(manifest.artifact, `dotdog-${version}.tgz`);
assert.ok([`v${version}`, `v${version}-npm`].includes(process.env.GITHUB_REF_NAME));
assert.equal(process.env.GITHUB_ACTIONS, 'true');
const artifact = join(dirname(file), manifest.artifact), bytes = readFileSync(artifact);
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), manifest.integrity);
npm(['publish', artifact, '--access', 'public', '--provenance'], { stdio: 'inherit' });
