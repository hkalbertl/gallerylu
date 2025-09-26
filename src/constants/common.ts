/**
 * Supported image extensions.
 */
export const IMAGE_EXT: string[] = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

/**
 * The date/time display format.
 */
export const DATE_TIME_DISPLAY_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * The number of images to fetch for each batch.
 */
export const GALLERY_BATCH_SIZE = 4;

/**
 * The number of time (ms) to wait between each batch.
 */
export const GALLERY_BATCH_SLEEP = 250;

/**
 * Maximum number of images will be loaded when entering a folder.
 */
export const GALLERY_FIRST_LOAD_IMAGES = 12;
