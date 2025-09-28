/**
 * The configuration values used by this app, such as FileLu API Key and S3 Access ID / Key.
 */
export interface GLConfig {
  /**
   * The provider type.
   */
  provider?: ProviderType;

  /**
   * FileLu native API Key.
   */
  apiKey?: string;

  /**
   * Access Key ID.
   */
  accessId?: string;

  /**
   * Secret Key.
   */
  secretKey?: string;

  hostName?: string;

  region?: string;

  urlStyle?: S3UrlStyle;
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
   * The full remote path to current folder. Such as `/TestS3/path/to/folder`.
   */
  path: string;
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
  'nameDesc',
  'uploaded'
}

export enum ProviderType {
  /**
   * FileLu S5 API (AWS S3 compatible)
   */
  'FileLuS5Api' = 's5',
  /**
   * AWS S3 API
   */
  'AwsS3Api' = 's3',
  /**
   * FileLu native API
   */
  'FileLuApi' = 'api',
}

export enum S3UrlStyle {
  path = 1,
  virtualHost = 2,
}
