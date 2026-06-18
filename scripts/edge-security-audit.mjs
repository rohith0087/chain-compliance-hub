import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseJwtDisabledFunctions(config) {
  const disabled = [];
  let current = null;
  for (const line of config.split(/\r?\n/)) {
    const section = line.match(/^\[functions\.([^\]]+)]$/);
    if (section) current = section[1];
    if (/^verify_jwt\s*=\s*false\s*$/.test(line) && current) disabled.push(current);
  }
  return disabled.sort();
}

async function main() {
  const [config, securityRaw, manifestRaw] = await Promise.all([
    readFile(path.join(root, 'supabase/config.toml'), 'utf8'),
    readFile(path.join(root, 'config/edge-functions.security.json'), 'utf8'),
    readFile(path.join(root, 'supabase/functions/.production-manifest.json'), 'utf8'),
  ]);
  const security = JSON.parse(securityRaw);
  const manifest = JSON.parse(manifestRaw);
  const entries = await readdir(path.join(root, 'supabase/functions'), { withFileTypes: true });
  const localFunctions = entries
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
    .map((entry) => entry.name)
    .sort();
  const errors = [];

  for (const functionName of manifest.functions) {
    if (!localFunctions.includes(functionName)) errors.push(`Production function missing locally: ${functionName}`);
  }

  const disabled = parseJwtDisabledFunctions(config);
  const allowlisted = Object.keys(security.jwtDisabledAllowlist).sort();
  for (const functionName of disabled) {
    if (!allowlisted.includes(functionName)) errors.push(`JWT-disabled function lacks a documented control: ${functionName}`);
  }
  for (const functionName of allowlisted) {
    if (!disabled.includes(functionName)) errors.push(`JWT-disabled allowlist is stale: ${functionName}`);
  }

  for (const functionName of security.systemSecretFunctions) {
    const source = await readFile(path.join(root, 'supabase/functions', functionName, 'index.ts'), 'utf8');
    if (!source.includes('SYSTEM_INVOCATION_SECRET') && !source.includes('validateSystemSecret')) {
      errors.push(`System function does not validate SYSTEM_INVOCATION_SECRET: ${functionName}`);
    }
  }

  for (const functionName of security.sharedCorsRequired) {
    const source = await readFile(path.join(root, 'supabase/functions', functionName, 'index.ts'), 'utf8');
    if (!source.includes("_shared/corsHeaders.ts")) errors.push(`Function bypasses shared CORS: ${functionName}`);
    if (source.includes("'Access-Control-Allow-Origin': '*'")) errors.push(`Function permits wildcard CORS: ${functionName}`);
  }

  const frontendFiles = await readdir(path.join(root, 'src'), { recursive: true, withFileTypes: true });
  for (const entry of frontendFiles) {
    if (!entry.isFile() || !/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    const sourcePath = path.join(entry.parentPath, entry.name);
    const source = await readFile(sourcePath, 'utf8');
    if (/SUPABASE_(SERVICE_ROLE|SECRET)_KEY/.test(source)) {
      errors.push(`Backend Supabase credential referenced by browser source: ${path.relative(root, sourcePath)}`);
    }
  }

  const secretEndpoint = await readFile(path.join(root, 'supabase/functions/get-openai-key/index.ts'), 'utf8');
  if (/Deno\.env\.get\(['"]OPENAI_API_KEY/.test(secretEndpoint) || /apiKey\s*:/.test(secretEndpoint)) {
    errors.push('get-openai-key must never read or return the OpenAI credential');
  }
  const cleanupEndpoint = await readFile(path.join(root, 'supabase/functions/cleanup-all-auth-users/index.ts'), 'utf8');
  if (cleanupEndpoint.includes('auth.admin.deleteUser')) errors.push('Bulk auth cleanup must not delete users over HTTP');

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`Edge security audit passed for ${localFunctions.length} local functions.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
