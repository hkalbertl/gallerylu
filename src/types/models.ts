/**
 * The configuration values used by this app, such as FileLu API Key and S3 Access ID / Key.
 */
export interface GLConfig {
  apiKey: string;
  s3Id: string;
  s3Secret: string;
}

export interface FileItem {

  /**
   * FileLu file code for native API.
   * Or file relative path for S3 API.
   */
  code: string;

  /**
   * FileLu file name.
   */
  name: string;

  /**
   * FileLu uploaded time.
   */
  uploaded: string;

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

  /**
   * File is encrypted or not.
   */
  encrypted: boolean;
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

export interface FileDirectLinkResult {
  url: string;
  url_prem: string;
  size: number;
}

export interface ListFolderResult {
  folderId: number;
  files: FileItem[];
  folders: FolderItem[];
}

export enum SortType {
  'name',
  'uploaded'
}

export type ConnectionMode = 's3' | 'api';

export const DateTimeDisplayFormat = 'YYYY-MM-DD HH:mm:ss';
