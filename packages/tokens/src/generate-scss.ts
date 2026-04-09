/**
 * Generates dist/_tokens.scss from tokens.ts.
 *
 * Run via: pnpm --filter @repo/tokens run generate
 * (Called automatically by the build script after tsc.)
 *
 * The generated file is committed to git. Never edit it by hand.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tokens } from './tokens.js';

const outPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/_tokens.scss',
);

function toKebab(camel: string): string {
  return camel.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

const lines: string[] = [
  '// GENERATED FILE. Do not edit by hand.',
  '// Source: packages/tokens/src/tokens.ts',
  '// Regenerate: pnpm --filter @repo/tokens run generate',
  '//',
  ':root {',
];

// Colors
lines.push('  // Colors');
for (const [name, value] of Object.entries(tokens.colors)) {
  lines.push(`  --${toKebab(name)}: ${value};`);
}

// Transitions
lines.push('');
lines.push('  // Transitions');
for (const [name, value] of Object.entries(tokens.transitions)) {
  lines.push(`  --transition-${name}: ${value};`);
}

lines.push('}');

writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`Generated ${outPath}`);
