import { openDB } from "idb";

export default class ImageCacheUtils {

  /**
   * Max. age of cache, 7 days in milliseconds
   */
  private static CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  private static async dbPromise() {
    return openDB("GalleryCache", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images", { keyPath: "id" });
        }
      },
    })
  };

  static async saveImageCache(id: string, encryptedBytes: Uint8Array) {
    const db = await ImageCacheUtils.dbPromise();
    await db.put("images", { id, data: encryptedBytes, timestamp: Date.now() });
  };

  static async getImageCache(id: string): Promise<Uint8Array | null> {
    const db = await ImageCacheUtils.dbPromise();
    const entry = await db.get("images", id);
    return entry ? entry.data : null;
  };

  static async deleteOldCaches() {
    try {
      const db = await openDB('GalleryCache', 1);
      const tx = db.transaction('images', 'readwrite');
      const store = tx.objectStore('images');
      const allKeys = await store.getAllKeys();

      const now = Date.now();
      const oneWeekAgo = now - ImageCacheUtils.CACHE_MAX_AGE;

      let deleted = 0;
      for (const key of allKeys) {
        const record = await store.get(key);
        if (record && record.timestamp < oneWeekAgo) {
          await store.delete(key);
          deleted++;
        }
      }

      await tx.done;
      if (0 < deleted) {
        console.log(`${deleted} image(s) cache cleaned.`);
      }
    } catch {
      console.warn('Failed to cleanup image cache, may be image cache is not used.');
    }
  }
}
