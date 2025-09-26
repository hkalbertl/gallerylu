import { GLConfig, ListFolderResult, FolderItem, ProviderType, SortType } from "../types/models";

/**
 * Interface for storage provider classes/
 */
export default interface StorageProvider {
  /**
   * Type of provider.
   */
  provider: ProviderType;
  /**
   * Export connection settings.
   */
  exportConfig(): GLConfig;
  /**
   * Validate the credentials defined in API client's constructor.
   * @returns Return undefined when connected successfully. Otherwise, error message returned.
   */
  validateCredentials(): Promise<string | undefined>;
  /**
   * List the content of specified remote directory path.
   * @param path Target directory that started with slash. Such as `/path/to/directory`.
   * @param sortType The sorting type of content.
   */
  listFolder(path: string, sortType: SortType): Promise<ListFolderResult>;
  /**
   * Delete the remote file.
   * @param fileRef File code for FileLu API or File path for others.
   */
  deleteFile(fileRef: string): Promise<void>;
  /**
   * Generate the path breadcrumbs by specified folder path.
   * @param folderPath The remote folder path, such as `/TestS3/path/to/sub/folder`
   */
  generatePathBreadcrumbs(folderPath: string): Promise<FolderItem[]>;
}
