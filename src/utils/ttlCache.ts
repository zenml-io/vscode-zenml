export class TtlCache<T> {
  private entries = new Map<string, { value: T; timestamp: number }>();

  constructor(private readonly ttlMs: number) {}

  public get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (this.isExpired(entry.timestamp)) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  public set(key: string, value: T): void {
    this.entries.set(key, { value, timestamp: Date.now() });
    this.prune();
  }

  public clear(): void {
    this.entries.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.ttlMs;
  }
}
