import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Alert, Breadcrumb, Button, ButtonGroup, Spinner } from "react-bootstrap";

import { Folder as FolderIcon, ExclamationTriangle, DashCircle, SortAlphaDown, Clock } from "react-bootstrap-icons";
import { Lightbox } from "yet-another-react-lightbox";
import { Captions, Zoom } from "yet-another-react-lightbox/plugins";
import WCipher from "wcipher";

import { FileItem, FolderItem, ListFolderResult, PathMap, PathBreadcrumb } from "../types/models";
import ApiUtils from "../utils/ApiUtils";
import AppUtils from "../utils/AppUtils";
import PasswordModal from "../components/PasswordModal";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import '../css/gallery.css';

function Gallery() {

  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [encPassword, setEncPassword] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<PathBreadcrumb[]>([]);
  const [listFolderId, setListFolderId] = useState<number>(0);
  const [mapping, setMapping] = useState<PathMap>({});
  const [sortType, setSortType] = useState<"name" | "uploaded">("name");
  const [images, setImages] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [askPassword, setAskPassword] = useState(false);
  const [fetchUrl, setFetchUrl] = useState<boolean>(false);
  const [summary, setSummary] = useState<string>('');
  const [index, setIndex] = useState(-1);
  const [failMsg, setFailMsg] = useState<string>('');

  // Check API key exists, or redirect to config page when not found
  useEffect(() => {
    const rawApiKey = localStorage.getItem("apiKey");
    if (rawApiKey) {
      setApiKey(rawApiKey);
    } else {
      navigate("/config"); // Redirect to Config page
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
            const folderContent: ListFolderResult = await ApiUtils.getFolderContent(apiKey!, parentId, sortType);
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
        const listResult: ListFolderResult = await ApiUtils.getFolderContent(apiKey, listFolderId, sortType);
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

        // Ask for decryption password if there are one or more encrypted files
        if (!encPassword && imageFiles.some(f => f.encrypted)) {
          // Ask for password if there are more than one encrypted images
          setAskPassword(true);
        } else {
          // Fetch full size URLs
          setFetchUrl(true);
        }
        // Show summary and stop loading
        setSummary(`${listResult.folders.length} folder(s), ${imageFiles.length} image(s) out of ${listResult.files.length} file(s)`);
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
    // Check fetch URL
    if (!fetchUrl) return;

    // Try to fetch full size URLs
    let isCancelled = false;
    const fetchFullUrls = async () => {
      // Exit if images not loaded
      if (0 === images.length) {
        return true;
      }

      // Fetch the full size image URL by batches
      const batchSize = 10;
      const newImages = [...images];

      // Change locked icon to loading
      let hasEncrypted = false;
      newImages.forEach(image => {
        if (image.encrypted) {
          image.thumbnail = '/loading.png';
          hasEncrypted = true;
        }
      });
      if (hasEncrypted) {
        setImages([...newImages]);
      }

      let shouldClearPassword = false;
      for (let b = 0; b < newImages.length; b += batchSize) {
        // Make sure it is working on the same path
        if (isCancelled) {
          console.warn('Working folder path changed...');
          return;
        }

        // Get current batch
        console.log(`Fetching batch[${b}]...`);
        const batch = newImages.slice(b, b + batchSize);

        // Make sure all items in current batch are finished
        await Promise.all(batch.map(async (image) => {
          // Request full size URL
          const linkResult = await ApiUtils.getFileDirectLink(apiKey!, image.code);
          // Check current image is encrypted or not
          if (image.encrypted) {
            // Check password
            if (encPassword) {
              // Download encrypted content

              // FileLu assigned CORS headers on the download server, it is required to use proxy to bypass the security checking
              let proxiedUrl = `/api/proxy/${linkResult.url.substring(linkResult.url.indexOf('/d/') + 3)}`;
              if (import.meta.env.PROD) {
                // proxiedUrl = `https://api.cors.lol/?url=${encodeURIComponent(linkResult.url)}`;
                // const tokens = linkResult.url.split('.filelu.live/');
                // proxiedUrl = `/proxy/${tokens[0].substring(tokens[0].indexOf('//') + 2)}/${tokens[1]}`;
                proxiedUrl = `/proxy?url=${encodeURIComponent(linkResult.url)}`;
              }

              const resp = await fetch(proxiedUrl);
              if (resp.ok) {
                // Try to decrypt the image
                try {
                  const fileNameWithoutEnc = image.name.substring(0, image.name.length - 4);
                  const encryptedBytes = await resp.arrayBuffer();
                  const decryptedBytes = await WCipher.decrypt(encPassword, new Uint8Array(encryptedBytes));
                  const imageBlob = new Blob([decryptedBytes], { type: AppUtils.getBlobTypeByExtName(fileNameWithoutEnc) });

                  const imageUrl = URL.createObjectURL(imageBlob);
                  image.title = `${fileNameWithoutEnc} (${AppUtils.toDisplaySize(decryptedBytes.length)} / ${image.uploaded})`;
                  image.src = imageUrl;
                  image.thumbnail = imageUrl;
                } catch (ex) {
                  console.warn('Failed to decrypted content: ' + image.name, ex);
                  image.thumbnail = '/stop-error.png';
                  shouldClearPassword = true;
                }
              } else {
                console.warn('Failed to download encrypted content: ' + image.name);
                image.thumbnail = '/stop-error.png';
              }
            } else {
              // No password?
              image.thumbnail = '/stop-error.png';
            }
          } else {
            // Not encrypted image, update full URL to target item
            image.title = `${image.name} (${AppUtils.toDisplaySize(linkResult.size)} / ${image.uploaded})`;
            image.src = linkResult.url;
          }
        }));

        // Make sure it is working on the same path
        if (isCancelled) {
          console.warn('Working folder path changed...');
          return;
        }

        // Update to the gallery
        setImages([...newImages]);
        console.log(`Fetch completed on batch[${b}]`);

        // Add delay if it is not the last batch
        if (b + batchSize < newImages.length) {
          // Sleep for 500ms to prevent rate limiting
          await AppUtils.sleep(500);
        }
      }
      if (shouldClearPassword) {
        setEncPassword(null);
      }
    };

    fetchFullUrls().finally(() => {
      setFetchUrl(false);
    });

    return () => {
      isCancelled = true; // Mark as cancelled when path changes
    };
  }, [folderPath, fetchUrl]);

  // Sort images
  useEffect(() => {
    if (!images.length) return;

    const newImages = [...images];
    if ('uploaded' === sortType) {
      // Sort by time DESC
      newImages.sort(AppUtils.sortByTimeDesc);
    } else {
      // Sort by name ASC
      newImages.sort(AppUtils.sortByNameAsc);
    }
    setImages(newImages);
  }, [sortType]);

  const handleImageClick = (imageIndex: number) => {
    // Show lightbox only when image full size URLs loaded
    if (images && imageIndex < images.length && images[imageIndex].src) {
      setIndex(imageIndex);
    }
  };

  const handlePasswordSubmit = (password: string) => {
    setEncPassword(password);
    setAskPassword(false);
    setFetchUrl(true);
  };

  return (
    <>
      <div className="d-flex align-items-center">
        <Breadcrumb className="flex-grow-1 mb-0">
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/gallery" }}>[Root]</Breadcrumb.Item>
          {!isLoading && 0 < breadcrumbs.length && <>
            {breadcrumbs.map((item, level) =>
              <Breadcrumb.Item key={level} active={(level === breadcrumbs.length - 1)}
                linkAs={Link} linkProps={{ to: item.navPath }}>
                {item.name}
              </Breadcrumb.Item>
            )}
          </>}
        </Breadcrumb>
        <div>
          {fetchUrl ? <>
            <Spinner size="sm" variant="primary" title="Retrieving full size image URLs..." />
          </> : <>
            <ButtonGroup size="sm">
              <Button variant="outline-primary" active={sortType === "name"} title="Sort by file name"
                onClick={() => setSortType("name")}>
                <SortAlphaDown />
              </Button>
              <Button variant="outline-primary" active={sortType === "uploaded"} title="Sort by latest uploaded time"
                onClick={() => setSortType("uploaded")}>
                <Clock />
              </Button>
            </ButtonGroup>
          </>}
        </div>
      </div>
      <hr />

      {isLoading &&
        <Alert variant="info" className="text-center">
          <Spinner size="sm" />&nbsp;Reading folder content...
        </Alert>
      }

      {!isLoading && <>
        {(0 !== folders.length || 0 !== images.length) && <>
          <div className="row">
            {folders.map(folder => (
              <div key={folder.id} className="col-6 col-md-4 col-lg-3 col-xxl-2 mb-4" title={folder.name}>
                <Link to={folder.navPath} className="card">
                  <div className="image-container">
                    <FolderIcon className="folder-icon" />
                  </div>
                  <div className="card-body">
                    <p className="card-text">{folder.name}</p>
                  </div>
                </Link>
              </div>
            ))}
            {0 < images.length && <>
              {images.map((image, imageIndex) => (
                <div key={image.code} className="col-6 col-md-4 col-lg-3 col-xxl-2 mb-4" title={image.title}>
                  <div className="card">
                    <div className="image-container">
                      <img src={image.thumbnail} className="img-fluid" alt={image.name}
                        onClick={() => handleImageClick(imageIndex)} />
                    </div>
                    <div className="card-body">
                      <p className="card-text">{image.name}</p>
                    </div>
                  </div>
                </div>
              ))}
              <Lightbox
                plugins={[Captions, Zoom]}
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
          <Alert variant="warning" className="text-center">
            <ExclamationTriangle />
            &nbsp;No images in this folder.
          </Alert>
        </>}
        {failMsg && <>
          <Alert variant="danger" className="text-center">
            <DashCircle />&nbsp;{failMsg}&nbsp;
            <Alert.Link href="/gallery">Go back to root folder</Alert.Link>.
          </Alert>
        </>}
        {summary && <>
          <hr />
          <div className="text-body-secondary text-end">{summary}</div>
        </>}
      </>}
      <PasswordModal
        show={askPassword}
        title="Decryption Password"
        onClose={() => setAskPassword(false)}
        onSubmit={handlePasswordSubmit}
      />
    </>
  );
}

export default Gallery;
