import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { redactText } from './redact.mjs';

const exec = promisify(execFile);

async function git(root, args) {
  try {
    const { stdout } = await exec('git', ['-C', root, ...args], { maxBuffer: 4 * 1024 * 1024 });
    return stdout.trimEnd();
  } catch (error) {
    return `git ${args.join(' ')} failed: ${error.stderr?.trim() || error.message}`;
  }
}

export function truncate(value, maxLines) {
  const lines = String(value ?? '').split('\n');
  if (lines.length <= maxLines) return { text: String(value ?? ''), truncated: false };
  return { text: `${lines.slice(0, maxLines).join('\n')}\n… ${lines.length - maxLines} more lines truncated`, truncated: true };
}

function statusFiles(status) {
  return status.split('\n').filter(Boolean).map((line) => {
    const code = line.slice(0, 2);
    return { status: code.trim() || '??', path: line.slice(3).trim() };
  });
}

export async function collectBrief({ root = '.', goal = 'Continue the current task', command = '', log = '', includeDiff = true, maxLines = 160, redact = true } = {}) {
  const absoluteRoot = path.resolve(root);
  const [branch, status, stat, diff] = await Promise.all([
    git(absoluteRoot, ['branch', '--show-current']),
    git(absoluteRoot, ['status', '--short']),
    git(absoluteRoot, ['diff', '--stat']),
    includeDiff ? git(absoluteRoot, ['diff', '--no-ext-diff', '--unified=2']) : Promise.resolve('')
  ]);
  const fields = [
    ['goal', goal], ['branch', branch], ['status', status], ['stat', stat], ['diff', diff], ['log', log], ['command', command]
  ];
  let redactions = 0;
  const sanitized = {};
  for (const [key, value] of fields) {
    const result = redact ? redactText(value) : { text: String(value ?? ''), count: 0 };
    sanitized[key] = result.text;
    redactions += result.count;
  }
  const diffResult = truncate(sanitized.diff, maxLines);
  const logResult = truncate(sanitized.log, maxLines);
  return {
    schema: 'agentbrief/v1',
    generatedAt: new Date().toISOString(),
    goal: sanitized.goal,
    repository: { branch: sanitized.branch, status: sanitized.status, stat: sanitized.stat },
    files: statusFiles(sanitized.status),
    evidence: { command: sanitized.command, log: logResult.text },
    diff: includeDiff ? diffResult.text : '',
    truncated: diffResult.truncated || logResult.truncated,
    redactions
  };
}
