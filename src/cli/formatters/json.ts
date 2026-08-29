/**
 * Hurdler CLI Subsystem - Structured JSON Formatter
 */

export function formatJsonOutput(data: unknown, pretty = true): string {
  try {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  } catch (err) {
    return JSON.stringify({
      error: 'Failed to serialize output to JSON',
      details: String(err),
    });
  }
}

export function printJson(data: unknown, pretty = true): void {
  console.log(formatJsonOutput(data, pretty));
}
