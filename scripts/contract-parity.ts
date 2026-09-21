import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { validateDataset } from '../shared/validate';

const original = JSON.parse(readFileSync('fixtures/dataset.v1.json', 'utf8'));
const cases: { name: string; path?: (string | number)[]; value?: unknown; valid: boolean }[] = JSON.parse(readFileSync('fixtures/contract-cases.json', 'utf8'));
const inputs = cases.map(test => {
  const data = structuredClone(original);
  if (test.path) {
    const parent = test.path.slice(0, -1).reduce((object, key) => object[key], data);
    parent[test.path.at(-1)!] = test.value;
  }
  let valid = true;
  try { validateDataset(data); } catch { valid = false; }
  assert.equal(valid, test.valid, 'TypeScript: ' + test.name);
  return { name: test.name, data, valid: test.valid };
});
const python = spawnSync(process.env.PYTHON ?? 'python', ['-c', `
import json,sys
from rdr2_extractor.contract import validate
for case in json.load(sys.stdin):
    try:
        validate(case['data'])
        valid=True
    except (ValueError, Exception):
        valid=False
    assert valid == case['valid'], 'Python: ' + case['name']
`], { input: JSON.stringify(inputs), encoding: 'utf8' });
assert.equal(python.status, 0, python.stderr);
console.log(`${cases.length} contract cases agree in Python and TypeScript`);
