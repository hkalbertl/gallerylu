import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import FileLu from "../utils/FileLu";
import { FolderItem } from "../types/filelu/folder";
import { FileItem } from "../types/filelu/file";

function Gallery() {

  const navigate = useNavigate();
  const location = useLocation();
  const stateFolderId: number = location.state?.folderId;
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);

  useEffect(() => {
    const rawApiKey = localStorage.getItem("apiKey");
    if (!rawApiKey) {
      navigate("/config"); // Redirect to Config page
    } else {
      setApiKey(rawApiKey);
    }
  }, [navigate]); // Dependency array to avoid unnecessary rerenders

  // Extract path from URL
  useEffect(() => {
    // The pathname should be something like /gallery/path/to/subfolder
    const rawFolderPath = location.pathname.substring(8) || '/';
    setFolderPath(rawFolderPath);
  }, [location]);

  useEffect(() => {
    // Check API key
    if (!apiKey) return;

    const loadGallery = async () => {

      // TODO: Find the correct folder ID by folder path
      let folderId = 0;
      if (stateFolderId) {
        folderId = stateFolderId;
      }

      // Get folder content
      const result = await FileLu.getFolderContent(apiKey, folderId);
      setFolders(result.folders.map(folder => {
        folder.path = '/gallery';
        if (1 < folderPath.length) {
          folder.path += folderPath;
        }
        folder.path += '/' + folder.name;

        return folder;
      }));

      /*
      const filledFiles = result.files.map(async (file: FileItem) => {
        const linkResult = await FileLu.getFileDirectLink(apiKey, file.file_code);
        file.download = linkResult.url;
        file.size = linkResult.size;
        return file;
      });
      Promise.all(filledFiles).then(files => {
        setFiles(files);
        setIsLoading(false);
      });
      */

      setFiles(result.files);
      setIsLoading(false);
    };

    setIsLoading(true);
    loadGallery();

  }, [apiKey, folderPath]);

  return <div>
    <h1>Gallery</h1>
    <p>Current path: {folderPath}</p>

    {isLoading && <div className="alert alert-info" role="alert">
      <div className="spinner-border spinner-border-sm" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      &nbsp;Reading folder content...
    </div>}

    {!isLoading && <>
      {0 < folders.length && <>
        <div className="row">
          {folders.map((folder: FolderItem) => (
            <div key={folder.fld_id} className="col-6 col-md-3 pb-4">
              <Link className="btn btn-outline-secondary w-100" to={folder.path} state={{ folderId: folder.fld_id }}>
                <i className="bi bi-folder"></i>
                &nbsp;{folder.name}
              </Link>
            </div>
          ))}
        </div>
      </>}
      {0 < files.length && <>
        <h2>Files</h2>
        <div className="row">
          {files.map((file: FileItem) => (
            <div key={file.file_code} className="col-6 col-sm-4 col-md-3 col-lg-2 pb-4">
              <img className="w-100" src={file.thumbnail} alt={file.name} title={`${file.name} / ${file.file_code} / ${file.size}`} />
            </div>
          ))}
        </div>
      </>}
    </>}
  </div>;
}

export default Gallery;
