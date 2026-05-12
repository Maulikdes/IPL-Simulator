export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}
