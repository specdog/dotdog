export function contractMismatches(expected: unknown, actual: unknown, path = '$'): string[] {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) return [path];
    return expected.flatMap((value, index) => contractMismatches(value, actual[index], `${path}[${index}]`));
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return [path];
    return Object.entries(expected).flatMap(([key, value]) => Object.hasOwn(actual, key) ? contractMismatches(value, (actual as Record<string, unknown>)[key], `${path}.${key}`) : [`${path}.${key}`]);
  }
  return Object.is(expected, actual) ? [] : [path];
}

export async function endpointBody(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Expected a JSON response body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error('Endpoint response exceeds 1 MiB');
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('Expected a JSON response body'); }
  } finally { await reader.cancel(); }
}
