import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createDemo } from '../../scripts/demo.mjs';

const repo = path.resolve('..');
const importer = path.join(repo, 'backend/src/db/import.ts');
if (!(await readFile(importer, 'utf8')).includes('--db')) throw new Error('Explicit-path importer must be implemented before E2E can start safely');
const root = await mkdtemp(path.join(tmpdir(), 'rdr2-e2e-'));
const db = path.join(root, 'test.sqlite');
const tsx = path.join(repo, 'backend/node_modules/.bin/tsx');
await createDemo(root);
const imported = spawnSync(tsx, [importer, path.join(root, 'dataset.json'), '--db', db, '--data-root', root], { cwd: repo, stdio: 'inherit' });
if (imported.status !== 0) { await rm(root, { recursive: true, force: true }); process.exit(1); }
await writeFile(path.join(root, 'test-context.json'), JSON.stringify({ root, db }));
// Only the dedicated fixture server exposes test context through this process-owned file.
await writeFile(new URL('./.runtime.json', import.meta.url), JSON.stringify({ root, db }));
const server = spawn(tsx, [path.join(repo, 'backend/src/index.ts')], { cwd: repo, stdio: 'inherit', env: { ...process.env, PORT: '3903', DB_PATH: db, DATA_ROOT: root, TILES_DIR: path.join(root, 'tiles') } });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.kill('SIGTERM');
  await new Promise(resolve => server.once('exit', resolve));
  await rm(root, { recursive: true, force: true });
  await rm(new URL('./.runtime.json', import.meta.url), { force: true });
  process.exit(0);
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
server.on('exit', code => { if (!closing) process.exit(code ?? 1); });
