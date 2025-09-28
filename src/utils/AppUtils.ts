import { FileItem } from "../types/models";
import { IMAGE_EXT } from "../constants/common";

/**
 * Get blob type by checking extension name of file.
 * @param fileName File name.
 * @returns The blob type.
 */
export function getBlobTypeByExtName(fileName: string) {
  if (fileName && -1 !== fileName.indexOf('.')) {
    const extName = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (['.jpg', '.jpeg'].includes(extName)) {
      return 'image/jpeg';
    } else if ('.png' === extName) {
      return 'image/png';
    } else if ('.gif' === extName) {
      return 'image/gif';
    } else if ('.bmp' === extName) {
      return 'image/bmp';
    } else if ('.webp' === extName) {
      return 'image/webp';
    }
  }
  return 'application/octet-stream';
}

/**
 * Get the error message from string or Error object.
 * @param ex Error message or error object.
 * @returns Just the string error message.
 */
export function getErrorMessage(ex: unknown): string {
  if ('string' === typeof ex) {
    return ex;
  } else if (ex instanceof Error) {
    return ex.message;
  }
  return `${ex}`;
}

/**
 * Filter out non-image files.
 * @param files Full list of files.
 * @returns Image only files.
 */
export function extractImages(files: FileItem[]): FileItem[] {
  return files.filter((item: FileItem) => {
    let fileName = item.name.toLowerCase();
    if (fileName.endsWith('.enc')) {
      fileName = fileName.substring(0, fileName.length - 4);
    }
    return IMAGE_EXT.some((ext: string) => fileName.endsWith(ext))
  });
}


/**
 * Generate readable size based on specified blob size.
 * @param value The numeric blob size.
 * @returns The readable size, such as "123.4 KB" / "4.6 MB".
 */
export function toDisplaySize(value: number): string {
  if (value && !isNaN(value)) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(1)} ${units[i]}`;
  }
  return 'N/A';
}

/**
 * Sleep for a while.
 * @param time Number of time in ms.
 */
export async function sleep(time: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, time));
}

/**
 * Sorting function for name ascending.
 */
export function sortByNameAsc(a: { name: string; }, b: { name: string; }) {
  return Intl.Collator().compare(a.name, b.name);
}

/**
 * Sorting function for name descending.
 */
export function sortByNameDesc(a: { name: string; }, b: { name: string; }) {
  return Intl.Collator().compare(b.name, a.name);
}

/**
 * Sorting function for date/time descending.
 */
export function sortByTimeDesc(a: { uploaded: string; }, b: { uploaded: string; }) {
  return Intl.Collator().compare(b.uploaded, a.uploaded);
}

