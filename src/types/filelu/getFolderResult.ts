import { FileItem } from "./file";
import { FolderItem } from "./folder";

export interface GetFolderResult {
  fld_id: number;
  files: FileItem[];
  folders: FolderItem[];
}
