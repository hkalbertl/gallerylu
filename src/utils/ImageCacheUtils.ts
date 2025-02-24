import { openDB, deleteDB } from "idb";

/**
 * The utility class for image caches.
 */
export default class ImageCacheUtils {

  /**
   * Max. age of cache, 7 days in milliseconds
   */
  private static CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  private static DATABASE_NAME = 'GalleryCache';

  private static STORE_NAME = 'images';

  private static async dbPromise() {
    return openDB(ImageCacheUtils.DATABASE_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(ImageCacheUtils.STORE_NAME)) {
          db.createObjectStore(ImageCacheUtils.STORE_NAME, { keyPath: 'id' });
        }
      },
    })
  };

  static async set(id: string, encryptedBytes: Uint8Array) {
    const db = await ImageCacheUtils.dbPromise();
    await db.put(ImageCacheUtils.STORE_NAME, { id, data: encryptedBytes, timestamp: Date.now() });
  };

  static async get(id: string): Promise<Uint8Array | null> {
    const db = await ImageCacheUtils.dbPromise();
    const entry = await db.get(ImageCacheUtils.STORE_NAME, id);
    return entry ? entry.data : null;
  };

  static async deleteExpired() {
    try {
      const db = await ImageCacheUtils.dbPromise();
      const allKeys = await db.getAllKeys(ImageCacheUtils.STORE_NAME);

      const now = Date.now();
      const expireLimit = now - ImageCacheUtils.CACHE_MAX_AGE;

      let deleted = 0;
      for (const key of allKeys) {
        const record = await db.get(ImageCacheUtils.STORE_NAME, key);
        if (record && record.timestamp < expireLimit) {
          await db.delete(ImageCacheUtils.STORE_NAME, key);
          deleted++;
        }
      }

      if (0 < deleted) {
        console.log(`${deleted} image(s) cache cleaned.`);
      }
    } catch (ex) {
      console.warn('Failed to cleanup image cache, may be image cache is not used.', ex);
    }
  }

  static async clearAll() {
    // const db = await ImageCacheUtils.dbPromise();
    // await db.clear(ImageCacheUtils.STORE_NAME);
    await deleteDB(ImageCacheUtils.DATABASE_NAME);
  }
}
