import { FileItem } from "../types/filelu/file";
import { FolderItem } from "../types/filelu/folder";
import { GetFolderResult } from "../types/filelu/getFolderResult";

export default class FileLu {

  private static BASE_URL = '/api/';

  /**
   * Validate the FileLu API key.
   * @param apiKey The FileLu API key to test.
   * @returns Return null if it is correct, otherwise the error message.
   */
  static async validateApiKey(apiKey: string): Promise<string | null> {
    let error: string | null = null;
    try {
      // Test API key
      const resp = await fetch(`${this.BASE_URL}account/info`, {
        method: 'POST',
        body: new URLSearchParams({ key: apiKey })
      });
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // Set success result
          return null;
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
    return error;
  }

  /**
   * Get files and sub-folders by specified folder ID.
   * @param apiKey FileLu API key.
   * @param folderId Target folder's ID, 0 is the root folder.
   * @returns The files and sub-folders of target folder.
   */
  static async getFolderContent(apiKey: string, folderId: number): Promise<GetFolderResult> {
    let error: string | null = null;
    try {
      // Get folder list
      const resp = await fetch(`${this.BASE_URL}folder/list?fld_id=${folderId}&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (json.result && Array.isArray(json.result.files) && Array.isArray(json.result.folders)) {
          // Found files and folders
          const files: FileItem[] = json.result.files;
          const folders: FolderItem[] = json.result.folders;
          const output: GetFolderResult = {
            fld_id: folderId,
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
}
