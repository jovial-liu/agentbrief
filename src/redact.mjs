const SECRET_PATTERNS = [
  /\b(?:ghp|gho|ghs|github_pat|sk|xox[baprs])_[A-Za-z0-9_\-]{12,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\-/]+=*/gi,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|private[_-]?key|secret|token)\s*[:=]\s*(["'`]?)[^\s"'`,}]+\1/gi
];

export function redactText(value) {
  let text = String(value ?? '');
  let count = 0;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match, quote) => {
      count += 1;
      if (quote !== undefined && match.includes('=')) {
        const key = match.slice(0, match.indexOf(quote));
        return `${key}${quote}<redacted>${quote}`;
      }
      if (/^Bearer\s/i.test(match)) return 'Bearer <redacted>';
      if (/^[A-Za-z_][\w-]*\s*[:=]/.test(match)) return match.replace(/([:=]).*$/, '$1 <redacted>');
      return '<redacted>';
    });
  }
  return { text, count };
}

export function redactObject(value) {
  const result = redactText(JSON.stringify(value));
  return { value: JSON.parse(result.text), count: result.count };
}
