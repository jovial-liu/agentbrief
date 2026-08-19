#!/usr/bin/env node
import fs from 'node:fs/promises';
import { collectBrief } from '../src/collect.mjs';
import { renderJson, renderMarkdown } from '../src/render.mjs';

const args = process.argv.slice(2);
if (args[0] === '--version' || args[0] === '-v') { console.log('0.1.0'); process.exit(0); }
if (['--help', '-h', 'help'].includes(args[0])) { printHelp(); process.exit(0); }
let root = process.env.GITHUB_WORKSPACE || '.'; let goal = process.env.INPUT_GOAL || 'Continue the current task'; let command = process.env.INPUT_COMMAND || ''; let logFile = process.env.INPUT_LOG || ''; let out = process.env.INPUT_OUTPUT || ''; let format = process.env.INPUT_FORMAT || 'markdown'; let includeDiff = process.env.INPUT_INCLUDE_DIFF !== 'false'; let redact = process.env.INPUT_NO_REDACT !== 'true'; let maxLines = 160; let title = 'Agent handoff brief';
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--root') root = args[++index] ?? '';
  else if (arg === '--goal') goal = args[++index] ?? '';
  else if (arg === '--command') command = args[++index] ?? '';
  else if (arg === '--log') logFile = args[++index] ?? '';
  else if (arg === '--out') out = args[++index] ?? '';
  else if (arg === '--format') format = args[++index] ?? '';
  else if (arg === '--title') title = args[++index] ?? title;
  else if (arg === '--max-lines') maxLines = Number(args[++index]);
  else if (arg === '--no-diff') includeDiff = false;
  else if (arg === '--no-redact') redact = false;
  else { console.error(`agentbrief: unknown option ${arg}`); process.exit(2); }
}
if (!['markdown', 'json'].includes(format) || !Number.isInteger(maxLines) || maxLines < 1) { console.error('agentbrief: invalid format or max-lines'); process.exit(2); }
if (!out) out = format === 'json' ? 'agentbrief.json' : 'AGENT_BRIEF.md';
try {
  const log = logFile === '-' ? await readStdin() : logFile ? await fs.readFile(logFile, 'utf8') : '';
  const brief = await collectBrief({ root, goal, command, log, includeDiff, maxLines, redact });
  const output = format === 'json' ? renderJson(brief) : renderMarkdown(brief, { title });
  const outputDirectory = out.includes('/') ? out.slice(0, out.lastIndexOf('/')) : '.';
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(out, `${output.trimEnd()}\n`, 'utf8');
  console.error(`agentbrief: wrote ${out} (${brief.files.length} files, ${brief.redactions} redactions)`);
} catch (error) { console.error(`agentbrief: ${error.message}`); process.exitCode = 2; }

async function readStdin() { let value = ''; for await (const chunk of process.stdin) value += chunk; return value; }
function printHelp() { console.log(`agentbrief 0.1.0\n\nCreate a safe, portable handoff brief from a Git worktree.\n\nUsage:\n  agentbrief [options]\n\nOptions:\n  --root <dir>           Repository root (default: .)\n  --goal <text>          What the next agent should accomplish\n  --command <text>       Reproduction or verification command\n  --log <file|->         Include a log file, or read the log from stdin\n  --format markdown|json Output format (default: markdown)\n  --out <file>           Output file (default: AGENT_BRIEF.md)\n  --title <text>         Markdown title\n  --max-lines <n>        Cap diff/log lines (default: 160)\n  --no-diff              Omit the working-tree patch\n  --no-redact            Keep token-shaped values (unsafe for sharing)\n\nExamples:\n  agentbrief --goal "Fix the flaky upload test" --command "npm test -- upload"\n  npm test 2>&1 | agentbrief --log - --goal "Make tests green"\n  agentbrief --format json --out handoff.json\n`); }
