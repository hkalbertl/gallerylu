import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

import { Lightbox } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";

import { FileItem, FolderItem, ListFolderResult, PathMap, PathBreadcrumb } from "../types/models";
import ApiUtils from "../utils/ApiUtils";
import AppUtils from "../utils/AppUtils";

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
  const [fetchUrl, setFetchUrl] = useState<boolean>(false);
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
          console.log('Processing breadcrumb path: ' + currentPath);

          // Find target folder ID
          let folderId = 0;
          if (paths[currentPath]) {
            // Folder ID found in mapping
            folderId = paths[currentPath];
            parentId = folderId;
            console.log('Folder ID for breadcrumb path found in mapping: ' + folderId);
          } else {
            // Folder is not found, retrieve it
            const folderContent: ListFolderResult = await ApiUtils.getFolderContent(apiKey!, parentId);
            console.log(`${currentPath} content: Folders=${folderContent.folders.length}, Files=${folderContent.files.length}`);
            folderContent.folders.forEach(folder => {
              // Update mapping
              paths = AppUtils.updatePathMap(paths, '/', folder);
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
        setFailMsg(AppUtils.getErrorMessage(err));
        setIsLoading(false);
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

    const loadGallery = async () => {
      try {
        // Get folder content
        let paths: PathMap = { ...mapping };
        const listResult: ListFolderResult = await ApiUtils.getFolderContent(apiKey, listFolderId);
        const subFolders = listResult.folders.map(folder => {
          paths = AppUtils.updatePathMap(paths, folderPath, folder);
          return folder;
        });
        setFolders(subFolders);
        setMapping((prevMapping) => ({
          ...prevMapping,
          ...paths
        }));

        // Filter out non-images files and find the direct link
        const imageFiles = AppUtils.extractImages(listResult.files);
        setImages(imageFiles);

        // Show summary and stop loading
        setSummary(`${listResult.folders.length} folder(s), ${imageFiles.length} image(s) out of ${listResult.files.length} file(s)`);

        // Try to fetch full size URLs after a small delay
        AppUtils.sleep(100).then(() => {
          setFetchUrl(true);
        });
      } catch (ex) {
        // Error occurred?
        const errorMsg = AppUtils.getErrorMessage(ex);
        console.error('Failed to load gallery: ' + errorMsg);
        setFailMsg(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadGallery();
  }, [apiKey, folderPath]);

  // Retrieve the full size image URLs when folder content loaded
  useEffect(() => {
    // Check API key and images
    if (!fetchUrl) return;
    if (0 === images.length) {
      setFetchUrl(false);
      return;
    }

    const fetchFullSizeImages = async () => {
      // Fetch the full size image URL by batches
      const batchSize = 10;
      const newImages = [...images];

      for (let b = 0; b < newImages.length; b += batchSize) {
        // Get current batch
        console.log(`Fetching batch[${b}]...`);
        const batch = newImages.slice(b, b + batchSize);

        // Make sure all items in current batch are finished
        await Promise.all(batch.map(async (image) => {
          // Request full size URL
          const linkResult = await ApiUtils.getFileDirectLink(apiKey!, image.code);
          // Update to target item
          image.title = `${image.name} (${AppUtils.toDisplaySize(linkResult.size)} / ${image.uploaded})`;
          image.src = linkResult.url;
        }));

        // Update to the gallery
        setImages([...newImages]);
        console.log(`Fetch completed on batch[${b}]`);

        // Add delay if it is not the last batch
        if (b + batchSize < newImages.length) {
          // Sleep for 500ms to prevent rate limiting
          await AppUtils.sleep(500);
        }
      }
    };

    fetchFullSizeImages().finally(() => {
      setFetchUrl(false);
    });
  }, [fetchUrl]);

  const handleImageClick = (imageIndex: number) => {
    // Show lightbox only when image full size URLs loaded
    if (!fetchUrl) {
      setIndex(imageIndex);
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center">
        <nav className="flex-grow-1" aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
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
        {fetchUrl && <div>
          <div className="spinner-border spinner-border-sm text-primary" role="status" title="Retrieving full size image URLs...">
            <span className="visually-hidden">Retrieving full size image URLs...</span>
          </div>
        </div>}
      </div>
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
                    onClick={() => handleImageClick(imageIndex)} />
                  <div className="gallery-title">{image.name}</div>
                </div>
              ))}
              <Lightbox
                plugins={[Captions]}
                captions={{ showToggle: true }}
                index={index}
                slides={images}
                open={index >= 0}
                close={() => setIndex(-1)}
              />
            </>}
          </div>
        </>}
        {0 === folders.length && 0 === images.length && !failMsg && <>
          <div className="alert alert-warning text-center" role="alert">
            <i className="bi bi-exclamation-triangle"></i>
            &nbsp;This is an empty folder.
          </div>
        </>}
        {failMsg && <>
          <div className="alert alert-danger text-center" role="alert">
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
