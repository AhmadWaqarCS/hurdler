/**
 * Hurdler CLI Subsystem - Terminal Output & UI Formatting Utilities
 */

export function printBanner(): void {
  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  🏃 HURDLER  -  AI Agentic Software Engineering Platform    │
└─────────────────────────────────────────────────────────────┘
`);
}

export function printHeader(title: string, subtitle?: string): void {
  console.log(`\n🔹 ${title}`);
  if (subtitle) {
    console.log(`   ${subtitle}`);
  }
}

export function printSection(title: string): void {
  console.log(`\n─── ${title} ───────────────────────────────────────`);
}

export function printSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

export function printError(message: string, suggestion?: string): void {
  console.error(`❌ Error: ${message}`);
  if (suggestion) {
    console.error(`   💡 Suggestion: ${suggestion}`);
  }
}

export function printWarning(message: string): void {
  console.warn(`⚠️  Warning: ${message}`);
}

export function printInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

export function printKeyValue(key: string, value: unknown, indent = 2): void {
  const pad = ' '.repeat(indent);
  const formattedVal =
    value === null || value === undefined
      ? '-'
      : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  console.log(`${pad}${key.padEnd(20)}: ${formattedVal}`);
}

export function printKeyValues(
  obj: Record<string, unknown>,
  indent = 2
): void {
  for (const [key, value] of Object.entries(obj)) {
    printKeyValue(key, value, indent);
  }
}

export function printCode(code: string, language?: string): void {
  console.log(`\n\`\`\`${language ?? ''}\n${code}\n\`\`\`\n`);
}

export function printDiff(diffText: string): void {
  console.log('\n--- Diff Output ---');
  const lines = diffText.split('\n');
  for (const line of lines) {
    if (line.startsWith('+')) {
      console.log(`\x1b[32m${line}\x1b[0m`);
    } else if (line.startsWith('-')) {
      console.log(`\x1b[31m${line}\x1b[0m`);
    } else if (line.startsWith('@@')) {
      console.log(`\x1b[36m${line}\x1b[0m`);
    } else {
      console.log(line);
    }
  }
  console.log('-------------------\n');
}

export function printBox(title: string, content: string[]): void {
  const maxLen = Math.max(
    title.length,
    ...content.map((c) => c.length)
  );
  const width = Math.max(maxLen + 4, 40);

  console.log('┌' + '─'.repeat(width) + '┐');
  console.log(`│ ${title.padEnd(width - 2)} │`);
  console.log('├' + '─'.repeat(width) + '┤');
  for (const line of content) {
    console.log(`│ ${line.padEnd(width - 2)} │`);
  }
  console.log('└' + '─'.repeat(width) + '┘');
}
