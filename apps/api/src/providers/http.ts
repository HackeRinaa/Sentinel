export async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/geo+json, application/json',
        'user-agent': 'Sentinel/1.0 (incident-intelligence-dashboard)',
      },
    });
    if (!response.ok) {
      throw new Error(`Upstream request failed with status ${response.status}`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Upstream request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
