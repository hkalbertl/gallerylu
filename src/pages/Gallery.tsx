import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

import { Lightbox } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";

import { FileItem, FolderItem, PathMap, PathBreadcrumb } from "../types/models";
import FileLu from "../utils/FileLu";
import GalleryLu from "../utils/Common";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import '../css/gallery.css';

function Gallery() {

  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<PathBreadcrumb[]>([]);
  const [listFolderId, setListFolderId] = useState<number>(0);
  const [mapping, setMapping] = useState<PathMap>({});
  const [images, setImages] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [index, setIndex] = useState(-1);
  const [failMsg, setFailMsg] = useState<string>('');

  // Check API key exists, or redirect to config page when not found
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
    // Check location and API key loaded
    if (!location || !apiKey) return;
    setIsLoading(true);

    // Define variables
    let paths: PathMap = { ...mapping };
    const segments: PathBreadcrumb[] = [];
    // The pathname should be something like /gallery/path/to/subfolder
    const fileLuPath = location.pathname.substring(8);
    if (1 < fileLuPath.length) {
      console.log('Build breadcrumb list for path: ', fileLuPath);
      // Build breadcrumbs
      let currentPath = '', parentId = 0;
      const pathSegments = fileLuPath.substring(1).split('/');

      async function processSegments() {
        let shouldSkip = false;
        for (const pathSegment of pathSegments) {
          // Set current path
          currentPath += `/${pathSegment}`;
          console.log('Processing path: ', currentPath);

          // Find target folder ID
          let folderId = 0;
          if (paths[currentPath]) {
            // Folder ID found in mapping
            folderId = paths[currentPath];
            parentId = folderId;
          } else {
            // Folder is not found, retrieve it
            const folderContent = await FileLu.getFolderContent(apiKey!, parentId);
            console.log(`Folder content of [${currentPath}] loaded: Folders: ${folderContent.folders.length}, Files: ${folderContent.files.length}`);
            folderContent.folders.forEach(folder => {
              // Update mapping
              paths = GalleryLu.updatePathMap(paths, '/', folder);
              // Keep if it is  current folder
              if (folder.name === pathSegment) {
                folderId = folder.id;
                parentId = folderId;
              }
            });
          }
          if (!folderId) {
            // Folder is not found, break the loop
            shouldSkip = true;
            break;
          }
          // Push to segment list
          segments.push({
            path: currentPath,
            navPath: `/gallery${currentPath}`,
            name: pathSegment,
            id: folderId
          } as PathBreadcrumb);
        }
        if (shouldSkip) {
          throw 'File path is not found.';
        }
      }
      processSegments().then(() => {
        // Use last parent ID as folder ID for listing
        setListFolderId(parentId);
        // All good!
        setMapping(paths);
        setBreadcrumbs(segments);
        setFolderPath(fileLuPath || '/');
      }).catch(err => {
        // Path not found or unknown errors
        setFailMsg(GalleryLu.getErrorMessage(err));
      });
    } else {
      // This is root path
      console.log('Using root path.');
      setListFolderId(0);
      setFolderPath('/');
    }
  }, [location, apiKey]);

  useEffect(() => {
    // Check API key
    if (!apiKey || !folderPath) return;

    // let paths: PathMap = { ...mapping };
    const loadGallery = async () => {
      // TODO: Find the correct folder ID by folder path
      /*
      let folderId = 0;
      if (stateFolderId) {
        // State folder ID found
        folderId = stateFolderId;
      } else if (1 < folderPath.length) {
        // Find the target folder from root
        const rootResult = await FileLu.getFolderContent(apiKey, 0);
        rootResult.folders.map(parseFolder);

        let reqPath = '';
        folderPath.substring(1).split('/').some(async segment => {
          // Find the current request path
          reqPath += '/' + segment;
          // Find folder ID
          const reqFolderId = paths[reqPath];
          if (reqFolderId) {
            const subFolderResult = await FileLu.getFolderContent(apiKey, reqFolderId);
            subFolderResult.folders.map(parseFolder);
          } else {
            // Folder not found
            reqPath = '';
            // Break the .some loop
            return true;
          }
        });
        if (!reqPath) {
          setIsLoading(false);
          setFailMsg('Folder path does not exists.');
          return;
        }
      }
      */

      // Get folder content
      let paths: PathMap = { ...mapping };
      const listResult = await FileLu.getFolderContent(apiKey, listFolderId);
      const subFolders = listResult.folders.map(folder => {
        paths = GalleryLu.updatePathMap(paths, folderPath, folder);
        return folder;
      });
      setFolders(subFolders);
      setMapping((prevMapping) => ({
        ...prevMapping,
        ...paths
      }));

      // Filter out non-images files and find the direct link
      const imageFiles = GalleryLu.extractImages(listResult.files);
      setImages(imageFiles);

      // Show summary and stop loading
      setSummary(`${listResult.folders.length} folder(s), ${imageFiles.length} image(s) out of ${listResult.files.length} file(s)`);
      setIsLoading(false);
    };

    loadGallery();

  }, [apiKey, folderPath]);

  useEffect(() => {
    // Check API key
    if (!apiKey || !images.length) return;

    // Get the full size image URL
    async function fetchFullSizeImages() {
      console.trace('Loading full size image URL: ', images.length);
      const updatedImages = await Promise.all(
        images.map(async (image) => {
          const linkResult = await FileLu.getFileDirectLink(apiKey!, image.code);
          return {
            ...image,
            title: `${image.name} (${GalleryLu.toDisplaySize(linkResult.size)})`,
            src: linkResult.url
          };
        })
      );
      setImages(updatedImages);
      console.trace('Full size image URL loaded');
    }
    if (0 < images.length && !images[0].src) {
      fetchFullSizeImages();
    }
  }, [images]);

  return (
    <div>
      <h1>Gallery</h1>

      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><a href="/gallery">[Root]</a></li>
          {!isLoading && 0 < breadcrumbs.length && <>
            {breadcrumbs.map((item, level) => (level === breadcrumbs.length - 1 ?
              <li key={level} className="breadcrumb-item active" aria-current="page">
                {item.name}
              </li> :
              <li key={level} className="breadcrumb-item">
                <a href={item.navPath}>{item.name}</a>
              </li>
            )
            )}
          </>}
        </ol>
      </nav>
      <hr />

      {isLoading && <div className="alert alert-info text-center" role="alert">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        &nbsp;Reading folder content...
      </div>}

      {!isLoading && <>
        {(0 !== folders.length || 0 !== images.length) && <>
          <div className="gallery-grid">
            {0 < folders.length && <>
              {folders.map(folder => (
                <Link key={folder.id} className="link-underline link-underline-opacity-0 link-underline-opacity-75-hover"
                  to={folder.navPath} state={{ folderId: folder.id }}>
                  <div className="gallery-item border rounded shadow-sm bg-body-tertiary" title={folder.name}>
                    <i className="bi bi-folder"></i>
                    <div className="gallery-title">{folder.name}</div>
                  </div>
                </Link>
              ))}
            </>}
            {0 < images.length && <>
              {images.map((image, imageIndex) => (
                <div key={image.code} className="gallery-item border rounded shadow-sm bg-body-tertiary" title={image.name}>
                  <img src={image.thumbnail} alt={image.name} className="gallery-thumbnail"
                    onClick={() => setIndex(imageIndex)} />
                  <div className="gallery-title">{image.name}</div>
                </div>
              ))}
              <Lightbox
                plugins={[Captions]}
                index={index}
                slides={images}
                open={index >= 0}
                close={() => setIndex(-1)}
              />
            </>}
          </div>
        </>}
        {0 === folders.length && 0 === images.length && <>
          <div className="alert alert-warning text-center" role="alert">
            <i className="bi bi-exclamation-triangle"></i>
            &nbsp;This is an empty folder.
          </div>
        </>}
        {failMsg && <>
          <div className="alert alert-warning text-center" role="alert">
            <i className="bi bi-dash-circle"></i>
            &nbsp;{failMsg} <a href="/gallery">Go back to root folder</a>.
          </div>
        </>}

        {summary && <>
          <hr />
          <div className="text-body-secondary text-end">{summary}</div>
        </>}
      </>}
    </div>
  );
}

export default Gallery;
