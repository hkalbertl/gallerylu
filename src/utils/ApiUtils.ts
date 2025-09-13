import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import AppUtils from "./AppUtils";
import { FileItem, FolderItem, FileDirectLinkResult, ListFolderResult, SortType, DateTimeDisplayFormat } from "../types/models";

// Load plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export default class ApiUtils {

  /**
   * FileLu API base URL.
   */
  private static API_BASE_URL = 'https://filelu.com/api';

  /**
   * FileLu time zone for file uploaded date/time.
   */
  private static API_TIME_ZOME = 'America/New_York';

  /**
   * Validate the FileLu API key.
   * @param apiKey The FileLu API key to test.
   * @returns Return null if it is correct, otherwise the error message.
   */
  static async validateApiKey(apiKey: string): Promise<void> {
    let error: string | null = null;
    try {
      // Test API key
      const resp = await fetch(`${this.API_BASE_URL}/account/info`, {
        method: 'POST',
        body: new URLSearchParams({ key: apiKey })
      });
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // Set success result
          return;
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
      error = `Unknown error: ${AppUtils.getErrorMessage(ex)}`;
    }
    throw error;
  }

  /**
   * Get files and sub-folders by specified folder ID.
   * @param apiKey FileLu API key.
   * @param folderId Target folder's ID, 0 is the root folder.
   * @param sortType The file sorting type.
   * @returns The files and sub-folders of target folder.
   */
  static async getFolderContent(apiKey: string, folderId: number, sortType: SortType): Promise<ListFolderResult> {
    let error: string | null = null;
    try {
      // Get folder list
      const resp = await fetch(`${this.API_BASE_URL}/folder/list?fld_id=${folderId}&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (json.result && Array.isArray(json.result.files) && Array.isArray(json.result.folders)) {
          // Cast the FileLu files to FileItem and apply sorting
          const files: FileItem[] = json.result.files.map((item: any) => {
            const fileItem = {
              code: item.file_code,
              name: item.name,
              // parent: item.fld_id,
              thumbnail: item.thumbnail,
              encrypted: false
            } as FileItem;
            // Convert time zone
            if (item.uploaded) {
              // FileLu is using EST time zone
              const localTime = dayjs.tz(item.uploaded, ApiUtils.API_TIME_ZOME).tz(dayjs.tz.guess());
              fileItem.uploaded = localTime.format(DateTimeDisplayFormat);
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
            files.sort(AppUtils.sortByTimeDesc);
          } else {
            files.sort(AppUtils.sortByNameAsc);
          }

          // Cast the FileLu folders to FolderItem and apply sorting
          const folders: FolderItem[] = json.result.folders.map((item: any) => ({
            id: item.fld_id,
            name: item.name
          } as FolderItem));
          folders.sort(AppUtils.sortByNameAsc);

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
      error = `Unknown error: ${AppUtils.getErrorMessage(ex)}`;
    }
    throw error;
  }

  /**
   * Get the file direct download link.
   * @param apiKey FileLu API key.
   * @param fileCode Target file code.
   * @returns Direct download link result.
   */
  static async getFileDirectLink(apiKey: string, fileCode: string): Promise<FileDirectLinkResult> {
    let error: string | null = null;
    try {
      // Test API key
      const resp = await fetch(`${this.API_BASE_URL}/file/direct_link`, {
        method: 'POST',
        body: new URLSearchParams({ key: apiKey, file_code: fileCode })
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
      error = `Unknown error: ${AppUtils.getErrorMessage(ex)}`;
    }
    throw error;
  }

  /**
   * Delete a file by file code.
   * @param apiKey FileLu API key.
   * @param fileCode Target file code.
   */
  static async deleteFile(apiKey: string, fileCode: string) :Promise<boolean> {
    let error: string | null = null;
    try {
      // Delete file
      const resp = await fetch(`${this.API_BASE_URL}/file/remove?file_code=${fileCode}&remove=1&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // File deleted
          return true;
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
      error = `Unknown error: ${AppUtils.getErrorMessage(ex)}`;
    }
    throw error;
  }
}
