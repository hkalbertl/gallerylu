import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FileLu from "../utils/FileLu";
import { FolderItem } from "../types/filelu/folder";
import { FileItem } from "../types/filelu/file";

function Gallery() {

  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
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
    const rawFolderPath = location.pathname.substring(8) || '/';
    setFolderPath(rawFolderPath);
  }, [location]);

  useEffect(() => {
    // Check API key
    if (!apiKey) return;

    const loadGallery = async () => {

      // TODO: Find the correct folder ID by folder path
      let folderId = 0;

      // Get folder content
      const result = await FileLu.getFolderContent(apiKey, folderId);
      setFolders(result.folders);
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
      <h2>Folders</h2>
      <ul>
        {folders.map((folder: any) => (
          <li key={folder.fld_id}>{folder.name}</li>
        ))}
      </ul>
      <h2>Files</h2>
      <ul>
        {files.map((file: any) => (
          <li key={file.file_code}>
            <a href={file.link} target="_blank" rel="noopener noreferrer">
              {file.name}
            </a>
          </li>
        ))}
      </ul>
    </>}
  </div>;
}

export default Gallery;
