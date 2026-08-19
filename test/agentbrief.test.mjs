import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { redactText } from '../src/redact.mjs';
import { renderMarkdown } from '../src/render.mjs';
import { truncate } from '../src/collect.mjs';

const run = promisify(execFile);

test('redacts common token-shaped values', () => {
  const result = redactText('token=super-secret-value Bearer abc.def.ghi ghp_1234567890abcdef');
  assert.equal(result.count, 3);
  assert.doesNotMatch(result.text, /super-secret|abc\.def|ghp_/);
  assert.match(result.text, /<redacted>/);
});

test('truncates noisy evidence with an explicit marker', () => {
  const result = truncate('one\ntwo\nthree', 2);
  assert.equal(result.truncated, true);
  assert.match(result.text, /1 more lines truncated/);
});

test('renders a handoff with changed files and safety note', () => {
  const output = renderMarkdown({
    goal: 'Fix upload', repository: { branch: 'main', stat: '1 file changed' },
    files: [{ status: 'M', path: 'src/upload.js' }], evidence: { command: 'npm test', log: 'failed' },
    diff: '+const fixed = true;', truncated: false, redactions: 1
  });
  assert.match(output, /# Agent handoff brief/);
  assert.match(output, /src\/upload\.js/);
  assert.match(output, /redacted locally/);
  assert.match(output, /const fixed/);
});

test('CLI creates a brief from a temporary repository', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'agentbrief-'));
  await run('git', ['-C', root, 'init', '-q']);
  await run('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  await run('git', ['-C', root, 'config', 'user.name', 'agentbrief test']);
  await writeFile(path.join(root, 'note.txt'), 'draft\n');
  const output = path.join(root, 'brief.md');
  const log = path.join(root, 'test.log');
  await writeFile(log, 'token=hidden');
  await run(process.execPath, [path.resolve('bin/agentbrief.mjs'), '--root', root, '--goal', 'Ship it', '--log', log, '--out', output]);
  const brief = await readFile(output, 'utf8');
  assert.match(brief, /Ship it/);
  assert.doesNotMatch(brief, /hidden/);
  assert.match(brief, /redacted/);
  assert.match(brief, /draft/);
});
