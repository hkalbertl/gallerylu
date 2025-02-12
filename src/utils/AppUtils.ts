import { FileItem, FolderItem, PathMap } from "../types/models";

export default class AppUtils {

  private static IMAGE_EXT: string[] = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

  /**
   * Get the error message from string or Error object.
   * @param ex Error message or error object.
   * @returns Just the string error message.
   */
  static getErrorMessage(ex: unknown): string {
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
  static extractImages(files: FileItem[]): FileItem[] {
    return files.filter((item: FileItem) =>
      this.IMAGE_EXT.some((ext: string) =>
        item.name.toLowerCase().endsWith(ext)));
  }


  /**
   * Generate readable size based on specified blob size.
   * @param value The numeric blob size.
   * @returns The readable size, such as "123.4 KB" / "4.6 MB".
   */
  static toDisplaySize(value: number): string {
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
   * Assign the navigation path of a FolderItem and update to the specified PathMap object.
   * @param mapping Target PathMap object.
   * @param parentPath Parent path of current folder.
   * @param folder FolderItem object to be updated.
   * @returns The updated PathMap object.
   */
  static updatePathMap(mapping: PathMap, parentPath: string, folder: FolderItem): PathMap {
    // Add to sub-folder mapping list
    const pathPrefix = (1 < parentPath.length ? parentPath : '');
    const subFolderPath = `${pathPrefix}/${folder.name}`;
    // Config the navigation path
    folder.navPath = `/gallery${pathPrefix}/${folder.name}`;
    // Return updated mapping
    return { ...mapping, [subFolderPath]: folder.id };
  }

  /**
   * Sleep for a while.
   * @param time Number of time in ms.
   */
  static async sleep(time: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, time));
  }
}
