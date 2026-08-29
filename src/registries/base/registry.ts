import type { z } from 'zod';
import type { IRegistry, RegistryOptions } from './types.js';
import {
  RegistryItemNotFoundError,
  RegistryItemAlreadyExistsError,
  RegistryValidationError,
  RegistryLockedError,
} from './errors.js';
import { deepFreeze } from '../../common/helpers.js';

/**
 * Universal Base Registry providing key-value storage, Zod schema validation,
 * immutability freezing, querying, and standardized error handling.
 */
export class BaseRegistry<TKey extends string | number | symbol, TItem> implements IRegistry<TKey, TItem> {
  readonly name: string;
  private readonly items = new Map<TKey, TItem>();
  private readonly schema?: z.ZodType<TItem>;
  private readonly keyExtractor?: (item: TItem) => TKey;
  private frozen = false;

  constructor(options: RegistryOptions<TKey, TItem>) {
    this.name = options.name;
    this.schema = options.schema;
    this.keyExtractor = options.keyExtractor;
    if (options.frozen) {
      this.frozen = true;
    }
  }

  /**
   * Returns true if registry is immutable.
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Freezes the registry, preventing any further registrations, updates, or deletions.
   */
  freeze(): this {
    this.frozen = true;
    for (const [key, val] of this.items.entries()) {
      if (val && typeof val === 'object') {
        deepFreeze(val as object);
      }
    }
    return this;
  }

  /**
   * Asserts that registry is not locked.
   */
  private assertNotFrozen(): void {
    if (this.frozen) {
      throw new RegistryLockedError(this.name);
    }
  }

  /**
   * Validates an item against the Zod schema if configured.
   */
  validate(item: unknown, key?: TKey): TItem {
    if (!this.schema) {
      return item as TItem;
    }
    const result = this.schema.safeParse(item);
    if (!result.success) {
      throw new RegistryValidationError(this.name, key ?? 'unknown', result.error.issues);
    }
    return result.data;
  }

  /**
   * Registers a single item.
   * Can be called as register(item) when keyExtractor is set, or register(key, item).
   */
  register(keyOrItem: TKey | TItem, item?: TItem): this {
    this.assertNotFrozen();

    let key: TKey;
    let valueToStore: TItem;

    if (item !== undefined) {
      key = keyOrItem as TKey;
      valueToStore = this.validate(item, key);
    } else {
      if (!this.keyExtractor) {
        throw new Error(
          `Registry '${this.name}' has no keyExtractor configured. You must specify a key: register(key, item).`
        );
      }
      valueToStore = this.validate(keyOrItem, undefined);
      key = this.keyExtractor(valueToStore);
    }

    if (this.items.has(key)) {
      throw new RegistryItemAlreadyExistsError(this.name, key);
    }

    this.items.set(key, valueToStore);
    return this;
  }

  /**
   * Registers multiple items at once.
   */
  registerMany(items: TItem[] | Record<string, TItem>): this {
    this.assertNotFrozen();

    if (Array.isArray(items)) {
      for (const item of items) {
        this.register(item);
      }
    } else {
      for (const [key, value] of Object.entries(items)) {
        this.register(key as unknown as TKey, value);
      }
    }
    return this;
  }

  /**
   * Unregisters an item by key.
   */
  unregister(key: TKey): boolean {
    this.assertNotFrozen();
    return this.items.delete(key);
  }

  /**
   * Checks if an item exists for the key.
   */
  has(key: TKey): boolean {
    return this.items.has(key);
  }

  /**
   * Retrieves an item by key or throws RegistryItemNotFoundError.
   */
  get(key: TKey): TItem {
    const item = this.items.get(key);
    if (item === undefined) {
      throw new RegistryItemNotFoundError(this.name, key);
    }
    return item;
  }

  /**
   * Retrieves an item by key or returns null if not found.
   */
  getOrNull(key: TKey): TItem | null {
    return this.items.get(key) ?? null;
  }

  /**
   * Returns all registered items as an array.
   */
  getAll(): TItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Returns all key-value pairs as an array of tuples.
   */
  getAllEntries(): [TKey, TItem][] {
    return Array.from(this.items.entries());
  }

  /**
   * Finds the first item matching a predicate function.
   */
  find(predicate: (item: TItem, key: TKey) => boolean): TItem | undefined {
    for (const [key, item] of this.items.entries()) {
      if (predicate(item, key)) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Filters items matching a predicate function.
   */
  filter(predicate: (item: TItem, key: TKey) => boolean): TItem[] {
    const results: TItem[] = [];
    for (const [key, item] of this.items.entries()) {
      if (predicate(item, key)) {
        results.push(item);
      }
    }
    return results;
  }

  /**
   * Returns the count of registered items.
   */
  count(): number {
    return this.items.size;
  }

  /**
   * Clears all items in the registry.
   */
  clear(): void {
    this.assertNotFrozen();
    this.items.clear();
  }
}
