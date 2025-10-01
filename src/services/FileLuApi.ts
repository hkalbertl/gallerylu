import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { DATE_TIME_DISPLAY_FORMAT } from "../constants/common";
import { ProviderType, FileDirectLinkResult, FileItem, FolderItem, GLConfig, ListFolderResult, SortType, PathMap } from "../types/models";
import { getErrorMessage, sortByNameAsc, sortByNameDesc, sortByTimeDesc } from "../utils/AppUtils";
import StorageProvider from "./StorageProvider";

// Load plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * FileLu Developer API client.
 */
export default class FileLuApi implements StorageProvider {

  /**
   * FileLu API base URL.
   */
  private static readonly API_BASE_URL = 'https://filelu.com/api/';

  /**
   * FileLu time zone for file uploaded date/time.
   */
  private static readonly API_TIME_ZOME = 'America/New_York';

  /**
   * FileLu API Key.
   */
  private readonly apiKey?: string;

  /**
   * The cached path to folder ID mapping. I can help to identify folder ID by path without re-request from the full path.
   */
  private readonly pathMapping: PathMap = {};

  constructor(apiKey?: string) {
    if (!apiKey || !apiKey.trim().length) {
      throw new Error('FileLu API Key is mandatory!');
    }
    this.apiKey = apiKey.trim();
  }

  readonly provider = ProviderType.FileLuApi;

  exportConfig(): GLConfig {
    return {
      provider: ProviderType.FileLuApi,
      apiKey: this.apiKey,
    };
  }

  async validateCredentials(): Promise<string | undefined> {
    let errorMessage: string | undefined;
    try {
      // Test API key by getting account info
      const res = await fetch(`${FileLuApi.API_BASE_URL}account/info`, {
        method: 'POST',
        body: new URLSearchParams({ key: this.apiKey || '' })
      });
      if (res.ok) {
        // HTTP OK! Parse as JSON
        const json = await res.json();
        if (200 === json.status) {
          // Set success result
          return undefined;
        } else if (403 === json.status || 400 === json.status) {
          // Invalid key
          errorMessage = `Error occurred during validation (status: ${json.status}): ${json.msg}`;
        } else {
          // Unknown status
          errorMessage = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Use the status code + text as error message
        errorMessage = `HTTP Error - Status ${res.status}: ${res.statusText}`;
      }
    } catch (ex) {
      // Unknown error
      console.error(`Failed to validate credentials to FileLu:`, ex);
      errorMessage = getErrorMessage(ex);
    }
    return errorMessage;
  }

  async listFolder(path: string, sortType: SortType): Promise<ListFolderResult> {
    // Check path is root
    let folderId = 0;
    if (path && 1 < path.length) {
      // Check path is cached
      folderId = this.pathMapping[path];
      if (!folderId) {
        // Path is not cached, call generate path segments first
        const segments = await this.generatePathBreadcrumbs(path);
        folderId = segments[segments.length - 1].id;
      }
    }
    // Request by using last folder ID
    return await this.listFolderByFolderId(folderId, path, sortType);
  }

  async deleteFile(fileCode: string): Promise<void> {
    let error: string | null = null;
    try {
      // Delete file
      const resp = await fetch(`${FileLuApi.API_BASE_URL}file/remove?file_code=${fileCode}&remove=1&key=${this.apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // File deleted
          return;
        } else {
          // Unknown status
          error = `Unknown API response (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${getErrorMessage(ex)}`;
    }
    throw error;
  };

  async generatePathBreadcrumbs(folderPath: string): Promise<FolderItem[]> {
    const segments: FolderItem[] = [];

    // Find the specified path in mapping
    let currentFolderId = 0, currentPath = '', level = 0;
    const pathSegments = folderPath.substring(1).split('/');
    for (const folderName of pathSegments) {
      const checkPath = `${currentPath}/${folderName}`;
      console.log(`L${++level}: ${checkPath}`);

      let folderId = this.pathMapping[checkPath] || 0;
      if (folderId) {
        // Caching found
        console.log(`> Path mapping found: ID=${folderId}`);
      } else {
        // Caching not found, query from its parent folder
        const folderContent = await this.listFolderByFolderId(currentFolderId, currentPath, SortType.name);
        folderContent.folders.forEach(folder => {
          // Update mapping
          const folderItemPath = `${currentPath}/${folder.name}`;
          this.pathMapping[folderItemPath] = folder.id;
          // Keep if it is current folder
          if (folder.name === folderName) {
            folderId = folder.id;
            console.log(`> Folder found: ID=${folderId}`);
          }
        });
      }
      if (!folderId) {
        throw new Error(`File path is not found: ${checkPath}`);
      }
      // Append to output segment
      segments.push({
        path: checkPath,
        name: folderName,
        id: folderId
      });
      currentFolderId = folderId;
      currentPath = checkPath;
    }
    return segments;
  }

  /**
   * Get files and sub-folders by specified folder ID.
   * @param folderId Target folder's ID, 0 is the root folder.
   * @param folderPath The remote folder path, such as `/path/to/subfolder`.
   * @param sortType The file sorting type.
   * @returns The files and sub-folders of target folder.
   */
  async listFolderByFolderId(folderId: number, folderPath: string, sortType: SortType): Promise<ListFolderResult> {
    let error: string | null = null;
    try {
      // Get folder list
      const resp = await fetch(`${FileLuApi.API_BASE_URL}folder/list?fld_id=${folderId}&key=${this.apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (json.result && Array.isArray(json.result.files) && Array.isArray(json.result.folders)) {
          // Cast the FileLu files to FileItem and apply sorting
          const files: FileItem[] = json.result.files.map((item: any) => {
            const fileItem = {
              code: item.file_code,
              name: item.name,
              thumbnail: item.thumbnail,
              encrypted: false
            } as FileItem;
            // Convert time zone
            if (item.uploaded) {
              // FileLu is using EST time zone
              const localTime = dayjs.tz(item.uploaded, FileLuApi.API_TIME_ZOME).tz(dayjs.tz.guess());
              fileItem.uploaded = localTime.format(DATE_TIME_DISPLAY_FORMAT);
              fileItem.title = `${fileItem.name} (${fileItem.uploaded})`;
            } else {
              // No uploaded time?
              fileItem.uploaded = '';
              fileItem.title = fileItem.name;
            }
            // Check if current file is encrypted
            if (fileItem.name.endsWith('.enc')) {
              fileItem.encrypted = true;
            }
            return fileItem;
          });
          if (SortType.uploaded === sortType) {
            files.sort(sortByTimeDesc);
          } else if (SortType.nameDesc === sortType) {
            files.sort(sortByNameDesc);
          } else {
            files.sort(sortByNameAsc);
          }

          // Cast the FileLu folders to FolderItem and apply sorting
          const folders: FolderItem[] = json.result.folders.map((fileLuFolder: any) => {
            // Parse raw object
            const folderItem: FolderItem = {
              id: fileLuFolder.fld_id,
              name: fileLuFolder.name,
              path: `${folderId ? folderPath : ''}/${fileLuFolder.name}`,
            };
            // Add to cache
            this.pathMapping[folderItem.path] = folderItem.id;
            // Return folder item
            return folderItem;
          });
          if (SortType.nameDesc === sortType) {
            folders.sort(sortByNameDesc);
          } else {
            folders.sort(sortByNameAsc);
          }

          // Return list folder result
          const output: ListFolderResult = {
            folderId: folderId,
            files,
            folders,
          };
          return output;
        } else {
          // Unknown status
          error = `Unknown API response (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${getErrorMessage(ex)}`;
    }
    throw error;
  }

  /**
   * Get the file direct download link.
   * @param apiKey FileLu API key.
   * @param fileCode Target file code.
   * @returns Direct download link result.
   */
  async getFileDirectLink(fileCode: string): Promise<FileDirectLinkResult> {
    let error: string | null = null;
    try {
      // Test API key
      const resp = await fetch(`${FileLuApi.API_BASE_URL}file/direct_link`, {
        method: 'POST',
        body: new URLSearchParams({ key: this.apiKey || '', file_code: fileCode })
      });
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // Set success result
          const linkResult: FileDirectLinkResult = json.result;
          return linkResult;
        } else if (400 === json.status) {
          // Invalid key
          error = `Invalid API key (status: ${json.status}): ${json.msg}`;
        } else {
          // Unknown status
          error = `Unknown API response (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${getErrorMessage(ex)}`;
    }
    throw error;
  }
}
