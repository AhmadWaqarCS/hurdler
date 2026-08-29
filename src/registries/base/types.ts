import type { z } from 'zod';

export interface RegistryOptions<TKey, TItem> {
  /** Name of the registry for error reporting and identification */
  name: string;
  /** Optional Zod schema for validating registered items */
  schema?: z.ZodType<TItem>;
  /** Optional key extractor function when registering item without explicit key */
  keyExtractor?: (item: TItem) => TKey;
  /** Whether the registry is frozen (immutable) upon initialization */
  frozen?: boolean;
}

export interface IRegistry<TKey, TItem> {
  readonly name: string;
  get(key: TKey): TItem;
  getOrNull(key: TKey): TItem | null;
  has(key: TKey): boolean;
  getAll(): TItem[];
  getAllEntries(): [TKey, TItem][];
  find(predicate: (item: TItem, key: TKey) => boolean): TItem | undefined;
  filter(predicate: (item: TItem, key: TKey) => boolean): TItem[];
  count(): number;
  register(keyOrItem: TKey | TItem, item?: TItem): this;
  registerMany(items: TItem[] | Record<string, TItem>): this;
  unregister(key: TKey): boolean;
  freeze(): this;
  isFrozen(): boolean;
  clear(): void;
}
