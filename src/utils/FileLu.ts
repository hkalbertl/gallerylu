import { FileItem, FolderItem } from "../types/models";
import { FileDirectLinkResult, ListFolderResult } from "../types/filelu";

const DIRECT_API_CALL = import.meta.env.VITE_DIRECT_API_CALL === "true";
export default class FileLu {

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
          error = `Error occurred during validation (status: ${json.status}): ${json.msg}`;
        } else {
          // Unknown status
          error = `Unknown response from server (status: ${json.status}): ${json.msg}`;
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
  static async getFolderContent(apiKey: string, folderId: number): Promise<ListFolderResult> {
    let error: string | null = null;
    try {
      // Get folder list
      const resp = await fetch(`${this.API_BASE_URL}/folder/list?fld_id=${folderId}&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (json.result && Array.isArray(json.result.files) && Array.isArray(json.result.folders)) {
          // Found files and folders
          const files: FileItem[] = json.result.files.map((item: any) => ({
            code: item.file_code,
            name: item.name,
            parent: item.fld_id,
            thumbnail: item.thumbnail,
          } as FileItem));
          files.sort((a: { name: string; }, b: { name: string; }) => Intl.Collator().compare(a.name, b.name));
          const folders: FolderItem[] = json.result.folders.map((item: any) => ({
            id: item.fld_id,
            name: item.name
          } as FolderItem));
          folders.sort((a: { name: string; }, b: { name: string; }) => Intl.Collator().compare(a.name, b.name));
          const output: ListFolderResult = {
            folderId: folderId,
            files,
            folders,
          };
          return output;
        } else {
          // Unknown status
          error = `Unknown response from server (status: ${json.status}): ${json.msg}`;
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
          error = `Error occurred during validation (status: ${json.status}): ${json.msg}`;
        } else {
          // Unknown status
          error = `Unknown response from server (status: ${json.status}): ${json.msg}`;
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
