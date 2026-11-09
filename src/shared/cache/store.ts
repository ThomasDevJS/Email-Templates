/** Script Cache (server) or User Cache (add-on) as this code uses it. The real `Cache` object satisfies it. */
export interface CacheStore {
  get(key: string): string | null;
  getAll(keys: string[]): Record<string, string>;
  put(key: string, value: string, ttlSeconds?: number): void;
  putAll(values: Record<string, string>, ttlSeconds?: number): void;
  removeAll(keys: string[]): void;
}
