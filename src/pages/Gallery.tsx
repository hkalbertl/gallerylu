import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Alert, Breadcrumb, Button, ButtonGroup, Spinner } from "react-bootstrap";
import { Folder as FolderIcon, Images, ExclamationTriangle, DashCircle, SortAlphaDown, Clock, Trash } from "react-bootstrap-icons";
import { Lightbox } from "yet-another-react-lightbox";
import { Captions, Zoom } from "yet-another-react-lightbox/plugins";
import WCipher from "wcipher";

import PasswordModal from "../components/PasswordModal";
import { FileItem, FolderItem, ListFolderResult, PathMap, PathBreadcrumb, SortType, GLConfig, ConnectionMode } from "../types/models";
import ApiUtils from "../utils/ApiUtils";
import AppUtils from "../utils/AppUtils";
import ImageCacheUtils from "../utils/ImageCacheUtils";
import ConfigUtils from "../utils/ConfigUtils";
import S3Utils from "../utils/S3Utils";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import '../css/gallery.scss';

function Gallery() {

  const BATCH_SIZE = 6;
  const BATCH_SLEEP = 400;

  /**
   * Maximum number of images will be loaded when entering a folder.
   */
  const FIRST_LOAD_IMAGES = 12;

  /**
   * Use proxy for encrypted images.
   */
  const USE_PROXY_ENC_IMAGES = true;

  const LOADING_SPINNER_URL = '/loading.png';
  const ENCRYPTED_LOCK_URL = '/locked.png';

  const navigate = useNavigate();
  const location = useLocation();
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("s3");
  const [glConfig, setGlConfig] = useState<GLConfig | null>(null);
  const [encPassword, setEncPassword] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<PathBreadcrumb[]>([]);
  const [listFolderId, setListFolderId] = useState<number>(0);
  const [filesInFolder, setFilesInFolder] = useState<number>(0);

  /**
   * The folder path / ID mapping for native API.
   */
  const [mapping, setMapping] = useState<PathMap>({});

  const [sortType, setSortType] = useState<SortType>(SortType.name);
  const [allImages, setAllImages] = useState<FileItem[]>([]);
  const [onScreenImages, setOnScreenImages] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [askPassword, setAskPassword] = useState(false);
  const [fetchContent, setFetchContent] = useState<boolean>(false);
  const [hasMoreImage, setHasMoreImage] = useState<boolean>(false);
  const [summary, setSummary] = useState<string>('');
  const [index, setIndex] = useState(-1);
  const [failMsg, setFailMsg] = useState<string>('');

  // Check API key exists, or redirect to config page when not found
  useEffect(() => {
    const savedConfig = ConfigUtils.loadConfig();
    if (!savedConfig.apiKey && !(savedConfig.s3Id || savedConfig.s3Secret)) {
      // Redirect to Config page
      navigate("/config");
    } else {
      // Config valid
      setGlConfig(savedConfig);
      if (!savedConfig.s3Id && !savedConfig.s3Secret && savedConfig.apiKey) {
        setConnectionMode('api');
      }
    }
  }, [navigate]);

  // Extract path from URL
  useEffect(() => {
    // Check location and API key loaded
    if (!location || !glConfig) return;
    setIsLoading(true);
    setIndex(-1);
    setHasMoreImage(false);

    // Clear old image cache on first visit
    if (isFirstVisit) {
      setIsFirstVisit(false);
      ImageCacheUtils.deleteExpired();
    }

    // Load session sorting type
    const sessionSortType = sessionStorage.getItem('sortType');
    if (sessionSortType) {
      if (SortType[SortType.uploaded] === sessionSortType) {
        setSortType(SortType.uploaded);
      } else if (SortType[SortType.name] === sessionSortType) {
        setSortType(SortType.name);
      }
    }

    // Define variables
    let paths: PathMap = { ...mapping };
    const segments: PathBreadcrumb[] = [];

    // The pathname should be something like /gallery/path/to/subfolder
    const fileLuPath = location.pathname.substring(8);
    if (1 < fileLuPath.length) {
      // Build breadcrumbs
      let currentPath = '';
      const pathSegments = fileLuPath.substring(1).split('/');

      if ('s3' === connectionMode) {
        // S3 mode, just split the path
        for (let segment of pathSegments) {
          currentPath += `/${segment}`;
          segments.push({
            id: 0,
            name: segment,
            path: currentPath,
            navPath: `/gallery${currentPath}`
          });
        }
        // All good!
        setBreadcrumbs(segments);
        setFolderPath(fileLuPath || '/');
      } else {
        // Define async function to build breadcrumbs by path segments
        let parentId = 0;
        const processSegments = async () => {
          let shouldSkip = false, level = 0;
          console.log(`Build breadcrumb list for path: ${fileLuPath}`);
          for (const pathSegment of pathSegments) {
            // Set current path
            currentPath += `/${pathSegment}`;
            console.log(`L${++level}: ${currentPath}`);

            // Find target folder ID
            let folderId = 0;
            if (paths[currentPath]) {
              // Folder ID found in mapping
              folderId = paths[currentPath];
              parentId = folderId;
              console.log(`> Path mapping found: ID=${folderId}`);
            } else {
              // Folder is not found, retrieve it
              const folderContent: ListFolderResult = await ApiUtils.getFolderContent(glConfig.apiKey, parentId, sortType);
              console.log(`> List content: Folders=${folderContent.folders.length}, Files=${folderContent.files.length}`);
              folderContent.folders.forEach(folder => {
                // Update mapping
                paths = AppUtils.updatePathMap(paths, '/', folder);
                // Keep if it is current folder
                if (folder.name === pathSegment) {
                  folderId = folder.id;
                  parentId = folderId;
                  console.log(`> Folder found: ID=${folderId}`);
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

        // Use .then() style instead of await due to useEffect limitation
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
      }
    } else {
      // This is root path
      console.log('Using root path.');
      if ('api' === connectionMode) {
        setListFolderId(0);
      }
      setBreadcrumbs([]);
      setFolderPath('/');
    }
  }, [location, glConfig]);

  // Load folder content
  useEffect(() => {
    // Check API key
    if (!glConfig || !folderPath) return;

    const loadGallery = async () => {
      try {
        // Check connection type
        let listResult: ListFolderResult = {
          folderId: 0,
          files: [],
          folders: [],
        }, summaryText: string;
        if ('s3' === connectionMode) {
          // FileLu S5 API
          if ('/' === folderPath) {
            // Get buckets
            const buckets = await S3Utils.listBuckets(glConfig.s3Id, glConfig.s3Secret);
            if (buckets && buckets.length) {
              // One or more buckets
              listResult.folders = buckets.map((bucket, index) => ({
                id: index,
                name: bucket,
                navPath: bucket
              }));
            }
          } else {
            // Get bucket content
            let bucketName = '', contentPath = '';
            const slashAfterBucket = folderPath.indexOf('/', 1);
            if (-1 === slashAfterBucket) {
              // Bucket root, such as /TestS3
              bucketName = folderPath.substring(1);
            } else {
              // Sub folder of bucket, such as /TestS3/Inner
              bucketName = folderPath.substring(1, slashAfterBucket);
              contentPath = folderPath.substring(slashAfterBucket + 1);
            }
            listResult = await S3Utils.listBucketContent(glConfig.s3Id, glConfig.s3Secret, bucketName, contentPath, sortType);
          }
          setFolders(listResult.folders);
        } else {
          // FileLu Native API
          let paths: PathMap = { ...mapping };

          // Get folder content
          listResult = await ApiUtils.getFolderContent(glConfig.apiKey, listFolderId, sortType);
          const subFolders = listResult.folders.map(folder => {
            paths = AppUtils.updatePathMap(paths, folderPath, folder);
            return folder;
          });
          setFolders(subFolders);
          setMapping((prevMapping) => ({
            ...prevMapping,
            ...paths
          }));
        }

        // Filter out non-images files
        const folderImages = AppUtils.extractImages(listResult.files);

        // Set thumbnail
        folderImages.forEach(image => {
          if (image.encrypted) {
            image.thumbnail = ENCRYPTED_LOCK_URL;
          }
          if (!image.thumbnail) {
            image.thumbnail = LOADING_SPINNER_URL;
          }
        });

        setAllImages(folderImages);
        setFilesInFolder(listResult.files.length);

        // Set viewable images
        let viewableImages: FileItem[];
        if (FIRST_LOAD_IMAGES < folderImages.length) {
          viewableImages = folderImages.slice(0, FIRST_LOAD_IMAGES);
          setHasMoreImage(true);
          summaryText = `${listResult.folders.length} folder(s), first ${FIRST_LOAD_IMAGES} of ${folderImages.length} image(s) showed, total ${listResult.files.length} file(s)`;
        } else {
          viewableImages = folderImages;
          summaryText = `${listResult.folders.length} folder(s), ${folderImages.length} image(s) out of ${listResult.files.length} file(s)`;
        }
        setOnScreenImages(viewableImages);

        // Ask for decryption password if there are one or more encrypted files
        if (!encPassword && viewableImages.some(f => f.encrypted)) {
          // Ask for password if there are more than one encrypted images
          setAskPassword(true);
        } else {
          // Fetch image content
          setFetchContent(true);
        }

        // Show summary and stop loading
        setSummary(summaryText);
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
  }, [glConfig, folderPath]);

  // Download folder content when current folder content loaded
  useEffect(() => {
    // Check fetch content enabled
    if (!fetchContent || !glConfig) return;

    // Use inner async function to download content
    let isCancelled = false;
    const downloadContent = async () => {
      // Exit if images not loaded
      if (0 === onScreenImages.length) {
        return true;
      }

      // Clone `on screen images` and update thumbnail as needed
      let updateOnScreenImages = false;
      const newImages = [...onScreenImages];
      newImages.forEach(image => {
        if (image.encrypted && !image.src) {
          image.thumbnail = LOADING_SPINNER_URL;
          updateOnScreenImages = true;
        }
      });
      if (updateOnScreenImages) {
        setOnScreenImages([...newImages]);
      }

      // Process on each batch
      let shouldClearPassword = false;
      for (let b = 0; b < newImages.length; b += BATCH_SIZE) {
        // Make sure it is working on the same path
        if (isCancelled) {
          console.warn('Working folder path changed...');
          return;
        }

        // Get current batch
        console.log(`Fetching batch[${b}]...`);
        const batch = newImages.slice(b, b + BATCH_SIZE);

        // Make sure all items in current batch are finished
        let shouldSleep = false;
        await Promise.all(batch.map(async (image) => {
          // Check if current image's src is defined
          if (image.src) {
            // Skip current image if the src is defined
            // Probably this is non-encrypted images by using native API
            return;
          }

          // Handle cached file binary
          let fileBytes: Uint8Array<ArrayBuffer> | null = null, readCache = false;
          if ('s3' === connectionMode) {
            // For S3 API, always check file cache
            readCache = true;
          } else {
            // For native API, check if file encryped
            if (image.encrypted && encPassword) {
              readCache = true;
            }
          }
          if (readCache) {
            fileBytes = await ImageCacheUtils.get(image.code);
            if (fileBytes) {
              console.log(`Image cache found: ${image.name}`);
            }
          }

          // Download image data if cache not found
          if (!fileBytes) {
            if ('s3' === connectionMode) {
              // For S3 API, make download request
              const resp = await S3Utils.makeDownloadRequest(glConfig.s3Id, glConfig.s3Secret, image.code);
              if (!resp.ok) {
                // Fetch failed?
                image.title = `Failed to download file content: HttpStatus=${resp.status}`;
                image.thumbnail = '/stop-error.png';
              } else {
                // Read as array buffer
                const fileBuffer = await resp.arrayBuffer();
                fileBytes = new Uint8Array<ArrayBuffer>(fileBuffer);

                // Cache the data
                ImageCacheUtils.set(image.code, fileBytes);
                console.log(`Image downloaded: ${image.name}`);
              }
            } else {
              // For native API, request full size URL
              const linkResult = await ApiUtils.getFileDirectLink(glConfig.apiKey, image.code);
              shouldSleep = true;

              // For encrypted images, download its binary
              if (image.encrypted) {
                // FileLu assigned CORS headers on the download server, it is required to use proxy to bypass the security checking
                let proxiedUrl: string | null = null;
                if (USE_PROXY_ENC_IMAGES) {
                  // Using the vercel rewrite module to bypass CORS problem
                  const tokens = linkResult.url.split('.cdnfinal.space/');
                  if (tokens && 2 === tokens.length) {
                    // Extract the subdomain of direct download link and build the proxy URL
                    proxiedUrl = `/proxy/${tokens[0].substring(tokens[0].indexOf('//') + 2)}/${tokens[1]}`;
                  } else {
                    console.warn(`Unknown direct link URL format: ${linkResult.url}`);
                  }
                } else {
                  // Use direct download link
                  proxiedUrl = linkResult.url;
                }

                // Check if proxied URL defined
                if (proxiedUrl) {
                  // Try to download binary data by using GET request
                  const resp = await fetch(proxiedUrl);
                  if (resp.ok) {
                    // Response OK!
                    fileBytes = new Uint8Array<ArrayBuffer>(await resp.arrayBuffer());
                    // Cache the data
                    ImageCacheUtils.set(image.code, fileBytes);
                    console.log(`Encrypted image downloaded: ${image.name}`);
                  } else {
                    // Fetch failed?
                    image.title = `Failed to download encrypted content: HttpStatus=${resp.status}`;
                    image.thumbnail = '/stop-error.png';
                  }
                } else {
                  // No proxy image URL?
                  image.title = 'Unsupported FileLu URL: ' + linkResult.url;
                  image.thumbnail = '/stop-error.png';
                }
              } else {
                // Not encrypted image, update full URL to target item
                image.title = `${image.name} (${AppUtils.toDisplaySize(linkResult.size)} / ${image.uploaded})`;
                image.src = linkResult.url;
              }
            }
          }

          // Check image binary
          if (fileBytes) {
            if (image.encrypted) {
              try {
                // Decrypt image
                const rawDecryptedBytes = await WCipher.decrypt(encPassword!, fileBytes),
                  decryptedBytes = rawDecryptedBytes as Uint8Array<ArrayBuffer>;

                // Trim the .enc extension, such as `image.jpg.enc` to `image.jpg`
                const fileNameWithoutEnc = image.name.substring(0, image.name.length - 4);
                const imageBlob = new Blob([decryptedBytes], { type: AppUtils.getBlobTypeByExtName(fileNameWithoutEnc) });
                const imageUrl = URL.createObjectURL(imageBlob);

                // Assign image data to image object
                image.title = `${fileNameWithoutEnc} (${AppUtils.toDisplaySize(decryptedBytes.length)} / ${image.uploaded})`;
                image.src = imageUrl;
                image.thumbnail = imageUrl;
              } catch (ex) {
                // Failed to decrypt, probably due to wrong password
                console.warn(`Failed to decrypted content: ${image.name}`, ex);
                image.thumbnail = '/stop-error.png';
                shouldClearPassword = true;
              }
            } else {
              // Normal images, such as downloaded from S3
              // Use object URL for image
              const imageBlob = new Blob([fileBytes], { type: AppUtils.getBlobTypeByExtName(image.name) }),
                imageUrl = URL.createObjectURL(imageBlob);
              image.src = imageUrl;
              image.thumbnail = imageUrl;
              image.title = `${image.name} (${AppUtils.toDisplaySize(fileBytes.byteLength)} / ${image.uploaded})`;
            }
          }
        }));

        // Update image URL back to allImages
        const newAllImages = [...allImages];
        for (let m = 0; m < batch.length; m++) {
          let shouldBreak = false;
          for (let n = 0; n < newAllImages.length; n++) {
            if (batch[m].code === newAllImages[n].code) {
              newAllImages[n].title = batch[m].title;
              newAllImages[n].thumbnail = batch[m].thumbnail;
              newAllImages[n].src = batch[m].src;
              shouldBreak = true;
              break;
            }
          }
          if (shouldBreak) {
            break;
          }
        }
        setAllImages(newAllImages);
        console.log(`Updated batch[${b}] to all images.`);

        // Make sure it is working on the same path
        if (isCancelled) {
          console.warn('Working folder path changed...');
          return;
        }

        // Update to the gallery
        setOnScreenImages([...newImages]);
        console.log(`Fetch completed on batch[${b}]`);

        // Add delay if it is not the last batch
        if (shouldSleep && b + BATCH_SIZE < newImages.length) {
          // Sleep for 500ms to prevent rate limiting
          await AppUtils.sleep(BATCH_SLEEP);
        }
      }
      if (shouldClearPassword) {
        setEncPassword(null);
      }
    };

    downloadContent().finally(() => {
      setFetchContent(false);
    });

    return () => {
      // Mark as cancelled when path changes
      isCancelled = true;
    };
  }, [folderPath, fetchContent]);

  // Sort images
  useEffect(() => {
    if (!onScreenImages.length) return;

    let newImages = [...allImages];
    if (SortType.uploaded === sortType) {
      // Sort by time DESC
      newImages.sort(AppUtils.sortByTimeDesc);
    } else {
      // Sort by name ASC
      newImages.sort(AppUtils.sortByNameAsc);
    }
    if (hasMoreImage) {
      newImages = newImages.slice(0, FIRST_LOAD_IMAGES);
    }
    setOnScreenImages(newImages);
    setFetchContent(true);

    // Save sorting type to session
    sessionStorage.setItem('sortType', SortType[sortType]);

  }, [sortType]);

  const handleImageClick = (imageIndex: number) => {
    // Show lightbox only when image full size URLs loaded
    if (onScreenImages && imageIndex < onScreenImages.length && onScreenImages[imageIndex].src) {
      setIndex(imageIndex);
    }
  };

  const handlePasswordSubmit = (password: string) => {
    // Save encryption password in memory
    setEncPassword(password);
    setAskPassword(false);
    setFetchContent(true);
  };

  const loadRemainingImages = () => {
    let newImages = [...allImages];
    if (SortType.uploaded === sortType) {
      // Sort by time DESC
      newImages.sort(AppUtils.sortByTimeDesc);
    } else {
      // Sort by name ASC
      newImages.sort(AppUtils.sortByNameAsc);
    }
    setOnScreenImages(newImages);
    setFetchContent(true);
    setHasMoreImage(false);
    setSummary(`${folders.length} folder(s), ${newImages.length} image(s) out of ${filesInFolder} file(s)`);
  };

  const handleImageDelete = async (imageIndex: number) => {
    // Confirm deletion
    const targetImage = onScreenImages[imageIndex];
    if (!confirm(`Are you sure to delete this image? ${targetImage.name}`)) {
      return;
    }

    try {
      // Set loading
      setIsLoading(true);

      // Send delete request
      const fileCode = targetImage.code;
      if ('s3' === connectionMode) {
        await S3Utils.deleteFile(glConfig!.s3Id, glConfig!.s3Secret, fileCode);
      } else {
        await ApiUtils.deleteFile(glConfig!.apiKey, fileCode);
      }

      // Refresh gallery
      const newOnScreenImages = onScreenImages.filter(img => img.code !== fileCode);
      setOnScreenImages(newOnScreenImages);
      const newAllImages = allImages.filter(img => img.code !== fileCode);
      setAllImages(newAllImages);
    } catch (ex) {
      const errorMsg = AppUtils.getErrorMessage(ex);
      console.error(`Failed to delete image[${targetImage.code}]: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="d-flex align-items-center">
        <Breadcrumb className="flex-grow-1 mb-0">
          {!isLoading && <>
            {0 < breadcrumbs.length && <>
              <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/gallery" }}>[Root]</Breadcrumb.Item>
              {breadcrumbs.map((item, level) =>
                <Breadcrumb.Item key={level} active={(level === breadcrumbs.length - 1)}
                  linkAs={Link} linkProps={{ to: item.navPath }}>
                  {item.name}
                </Breadcrumb.Item>
              )}
            </>}
          </>}
        </Breadcrumb>
        <div>
          {fetchContent ? <>
            <Spinner size="sm" variant="primary" title="Retrieving folder content..." />
          </> : <>
            <ButtonGroup size="sm">
              <Button variant="outline-primary" active={SortType.name === sortType} title="Sort by file name"
                onClick={() => setSortType(SortType.name)}>
                <SortAlphaDown />
              </Button>
              <Button variant="outline-primary" active={SortType.uploaded === sortType} title="Sort by latest uploaded time"
                onClick={() => setSortType(SortType.uploaded)}>
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
        {(0 !== folders.length || 0 !== onScreenImages.length) && <>
          <div className="gallery-view row">
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
            {0 < onScreenImages.length && <>
              {onScreenImages.map((image, imageIndex) => (
                <div key={image.code} className="col-6 col-md-4 col-lg-3 col-xxl-2 mb-4" title={image.title}>
                  <div className="card">
                    <div className="image-container">
                      <img src={image.thumbnail} className="img-fluid" alt={image.name}
                        onClick={() => handleImageClick(imageIndex)} />
                    </div>
                    <div className="card-body">
                      <p className="card-text">{image.name}</p>
                    </div>
                    <div className="card-hover-menu">
                      <Button variant="danger" size="sm" title="Delete" onClick={() => handleImageDelete(imageIndex)}>
                        <Trash />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <Lightbox
                plugins={[Captions, Zoom]}
                captions={{ hidden: true, showToggle: true }}
                index={index}
                slides={onScreenImages}
                open={index >= 0}
                close={() => setIndex(-1)}
              />
            </>}
          </div>
          {hasMoreImage && <button type="button" className="btn btn-primary w-100" disabled={fetchContent}
            onClick={() => loadRemainingImages()}>
            <Images />&nbsp;Load remaining images</button>}
        </>}
        {0 === folders.length && 0 === onScreenImages.length && !failMsg && <>
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
