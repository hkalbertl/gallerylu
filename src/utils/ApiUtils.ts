import { FileItem, FolderItem, FileDirectLinkResult, ListFolderResult } from "../types/models";
import AppUtils from "./AppUtils";

const DIRECT_API_CALL = import.meta.env.VITE_DIRECT_API_CALL === "true";
export default class ApiUtils {

  /**
   * FileLu API base URL.
   * Vite proxy is used for `development` due to CORS issues.
   */
  private static API_BASE_URL = `${DIRECT_API_CALL ? 'https://filelu.com' : ''}/api`;

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
      error = `Unknown error: ${ex}`;
    }
    throw error;
  }

  /**
   * Get files and sub-folders by specified folder ID.
   * @param apiKey FileLu API key.
   * @param folderId Target folder's ID, 0 is the root folder.
   * @returns The files and sub-folders of target folder.
   */
  static async getFolderContent(apiKey: string, folderId: number, sortType: string): Promise<ListFolderResult> {
    let error: string | null = null;
    try {
      // Get folder list
      const resp = await fetch(`${this.API_BASE_URL}/folder/list?fld_id=${folderId}&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (json.result && Array.isArray(json.result.files) && Array.isArray(json.result.folders)) {
          // Cast the FileLu files to FileItem and apply sorting
          const files: FileItem[] = json.result.files.map((item: any) => ({
            code: item.file_code,
            name: item.name,
            title: `${item.name} (${item.uploaded})`,
            uploaded: item.uploaded,
            parent: item.fld_id,
            thumbnail: item.thumbnail,
          } as FileItem));
          if ('uploaded' === sortType) {
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
      error = `Unknown error: ${ex}`;
    }
    throw error;
  }

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
      error = `Unknown error: ${ex}`;
    }
    throw error;
  }
}
