import fs from 'node:fs';
import path from 'node:path';

const functionName = process.argv[2];
const root = path.resolve('supabase/functions');
const pending = [path.join(root, functionName, 'index.ts')];
const denoConfig = path.join(root, functionName, 'deno.json');
if (fs.existsSync(denoConfig)) pending.push(denoConfig);
const seen = new Set();
const files = [];

while (pending.length) {
  const file = pending.pop();
  if (!file || seen.has(file)) continue;
  seen.add(file);
  const content = fs.readFileSync(file, 'utf8');
  files.push({ name: path.relative(root, file), content });
  if (!file.endsWith('.ts')) continue;
  const imports = content.matchAll(/(?:from\s+|import\s*)['"](\.\.?\/[^'"]+)['"]/g);
  for (const match of imports) {
    let dependency = path.resolve(path.dirname(file), match[1]);
    if (!path.extname(dependency)) dependency += '.ts';
    if (dependency.startsWith(root) && fs.existsSync(dependency)) pending.push(dependency);
  }
}

process.stdout.write(JSON.stringify(files));
