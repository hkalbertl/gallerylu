import { FileItem, FolderItem} from './models';

export interface FileDirectLinkResult {
  url: string;
  size: number;
}

export interface ListFolderResult {
  folderId: number;
  files: FileItem[];
  folders: FolderItem[];
}
