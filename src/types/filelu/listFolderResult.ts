import { FileItem } from "./file";
import { FolderItem } from "./folder";

export interface ListFolderResult {
  fld_id: number;
  files: FileItem[];
  folders: FolderItem[];
}
