import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const baseline = JSON.parse(readFileSync(new URL('../config/eslint-baseline.json', import.meta.url), 'utf8'));
const eslintBin = new URL('../node_modules/.bin/eslint', import.meta.url).pathname;
const result = spawnSync(eslintBin, ['.', '-f', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

if (!result.stdout) {
  console.error(result.stderr || 'ESLint did not produce JSON output.');
  process.exit(1);
}

const report = JSON.parse(result.stdout);
const current = { errors: 0, warnings: 0, rules: {} };
for (const file of report) {
  current.errors += file.errorCount;
  current.warnings += file.warningCount;
  for (const message of file.messages) {
    const severity = message.severity === 2 ? 'error' : 'warning';
    const key = `${severity}:${message.ruleId || 'unknown'}`;
    current.rules[key] = (current.rules[key] || 0) + 1;
  }
}

const regressions = [];
for (const [rule, count] of Object.entries(current.rules)) {
  const allowed = baseline.rules[rule] || 0;
  if (count > allowed) regressions.push(`${rule}: ${count} (baseline ${allowed})`);
}
if (current.errors > baseline.errors) regressions.push(`total errors: ${current.errors} (baseline ${baseline.errors})`);
if (current.warnings > baseline.warnings) regressions.push(`total warnings: ${current.warnings} (baseline ${baseline.warnings})`);

if (regressions.length) {
  console.error(`ESLint baseline regressed:\n${regressions.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`ESLint baseline passed: ${current.errors} errors and ${current.warnings} warnings (no regression).`);
