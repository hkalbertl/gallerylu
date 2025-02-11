export interface FileItem {

  /**
   * FileLu file code.
   */
  code: string;

  /**
   * FileLu file name.
   */
  name: string;

  /**
   * FileLu folder ID.
   */
  parent: number;

  /**
   * FileLu thumbnail URL.
   */
  thumbnail: string;

  /**
   * FileLu direct download URL.
   */
  src: string;

  /**
   * The title displayed in Gallery LightBox.
   */
  title: string;
}

export interface FolderItem {
  /**
   * FileLu folder ID.
   */
  id: number;

  /**
   * FileLu folder name.
   */
  name: string;

  /**
   * The navigation path on GalleryLu.
   * The content should start with `/gallery`.
   */
  navPath: string;

  // Other FileLu properties but not in use:
  // code: string | null;
}

export interface PathBreadcrumb {
  id: number;
  path: string;
  navPath: string;
  name: string;
}

export interface PathMap {
  [path: string]: number;
}
