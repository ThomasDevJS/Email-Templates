/** In-memory PropertiesService. Models the 9 KB per value limit [R4 S2]. */
export const PROPERTY_VALUE_LIMIT_BYTES = 9 * 1024;

export class FakeProperties {
  private readonly values = new Map<string, string>();

  getProperty(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  getProperties(): Record<string, string> {
    return Object.fromEntries(this.values);
  }

  getKeys(): string[] {
    return [...this.values.keys()];
  }

  setProperty(key: string, value: string): this {
    if (new TextEncoder().encode(value).length > PROPERTY_VALUE_LIMIT_BYTES) {
      throw new Error("Argument too large: value");
    }
    this.values.set(key, value);
    return this;
  }

  setProperties(properties: Record<string, string>): this {
    for (const [key, value] of Object.entries(properties))
      this.setProperty(key, value);
    return this;
  }

  deleteProperty(key: string): this {
    this.values.delete(key);
    return this;
  }

  deleteAllProperties(): this {
    this.values.clear();
    return this;
  }
}

export interface FakePropertiesService {
  readonly script: FakeProperties;
  readonly user: FakeProperties;
  getScriptProperties(): FakeProperties;
  getUserProperties(): FakeProperties;
  getDocumentProperties(): null;
}

export function createPropertiesService(): FakePropertiesService {
  const script = new FakeProperties();
  const user = new FakeProperties();
  return {
    script,
    user,
    getScriptProperties: () => script,
    getUserProperties: () => user,
    getDocumentProperties: () => null,
  };
}
