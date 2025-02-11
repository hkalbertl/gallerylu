export interface FileItem {
  // FileLu properties
  fld_id: number;
  file_code: string;
  name: string;
  thumbnail: string;

  // Custom properties
  download: string;
  size: number;

  // Other FileLu properties but not in use:
  // link: string;
  // uploaded: string;
}
