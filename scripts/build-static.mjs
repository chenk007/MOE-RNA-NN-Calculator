import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('public/', root);
// A fixed generated output directory and explicit allowlist keep source/config/secrets out.
await rm(output, { recursive: true, force: true });
for (const path of [
  'index.html', 'parameters.json', 'css/style.css',
  'js/calculator.js', 'js/parameters.js', 'js/i18n.js',
]) {
  const target = new URL(path, output);
  await mkdir(new URL('./', target), { recursive: true });
  await copyFile(new URL(path, root), target);
}
console.log(`Copied 6 unchanged website files to ${fileURLToPath(output)}`);
