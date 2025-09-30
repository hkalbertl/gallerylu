import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Alert, Breadcrumb, Button, ButtonGroup, Spinner } from "react-bootstrap";
import { Folder as FolderIcon, Images, ExclamationTriangle, DashCircle, SortAlphaDown, Clock, Trash, SortAlphaUp } from "react-bootstrap-icons";
import { Lightbox } from "yet-another-react-lightbox";
import { Captions, Zoom } from "yet-another-react-lightbox/plugins";
import WCipher from "wcipher";
import { GALLERY_BATCH_SIZE, GALLERY_BATCH_SLEEP, GALLERY_FIRST_LOAD_IMAGES, S3_DESCRIPTION_HEADER_NAME } from "../constants/common";
import PasswordModal from "../components/PasswordModal";
import { FileItem, FolderItem, SortType, ProviderType } from "../types/models";
import { extractImages, getBlobTypeByExtName, getErrorMessage, sleep, sortByNameAsc, sortByNameDesc, sortByTimeDesc, toDisplaySize } from "../utils/AppUtils";
import ImageCacheUtils from "../utils/ImageCacheUtils";
import ConfigUtils from "../utils/ConfigUtils";
import StorageProvider from "../services/StorageProvider";
import FileLuS5Api from "../services/FileLuS5Api";
import FileLuApi from "../services/FileLuApi";
import AwsS3Api from "../services/AwsS3Api";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import '../css/gallery.scss';

function Gallery() {

  /**
   * Use proxy for encrypted images.
   */
  const USE_PROXY_ENC_IMAGES = true;

  const LOADING_SPINNER_URL = '/loading.png';
  const ENCRYPTED_LOCK_URL = '/locked.png';
  const STOP_ERROR_URL = '/stop-error.png';

  const navigate = useNavigate();
  const location = useLocation();
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [providerType, setProviderType] = useState<ProviderType>(ProviderType.FileLuS5Api);
  const [encPassword, setEncPassword] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<FolderItem[]>([]);
  const [filesInFolder, setFilesInFolder] = useState<number>(0);
  const [showCaption, setShowCaption] = useState(false);
  const [requestMeta, setRequestMeta] = useState(false);
  const apiClientRef = useRef<StorageProvider>(undefined);

  const [sortType, setSortType] = useState<SortType>(SortType.name);
  const [allImages, setAllImages] = useState<FileItem[]>([]);
  const [onScreenImages, setOnScreenImages] = useState<FileItem[]>([]);
  const [folderItems, setFolderItems] = useState<FolderItem[]>([]);
  const [askPassword, setAskPassword] = useState(false);
  const [fetchContent, setFetchContent] = useState<boolean>(false);
  const [hasMoreImage, setHasMoreImage] = useState<boolean>(false);
  const [summaryText, setSummaryText] = useState<string>('');
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [failMsg, setFailMsg] = useState<string>('');

  // Check API client exists, or redirect to config page when not found
  useEffect(() => {
    // Check if API client's configuration update
    const savedConfig = ConfigUtils.loadConfig();
    if (apiClientRef.current) {
      if (apiClientRef.current.provider === savedConfig.provider) {
        // Same provider, no further actions needed
        return;
      }
    }
    // Page first load or config provider changed
    let apiClient: StorageProvider | undefined = undefined;
    if (savedConfig?.provider) {
      if (ProviderType.FileLuS5Api === savedConfig.provider) {
        apiClient = new FileLuS5Api(savedConfig.accessId, savedConfig.secretKey);
      } else if (ProviderType.FileLuApi === savedConfig.provider) {
        apiClient = new FileLuApi(savedConfig.apiKey);
      } else if (ProviderType.AwsS3Api === savedConfig.provider) {
        apiClient = new AwsS3Api(savedConfig.accessId, savedConfig.secretKey,
          savedConfig.hostName, savedConfig.region, savedConfig.urlStyle);
      }
    }
    // Check API client created
    if (apiClient) {
      apiClientRef.current = apiClient;
      setProviderType(apiClient.provider);
      setShowCaption(!!savedConfig.showCaption);
      setRequestMeta(!!savedConfig.requestMeta);
      console.debug(`Using provider: ${apiClient.provider}`);
    } else {
      // Redirect to Config page
      navigate("/config");
    }
  }, [navigate]);

  // Extract path from URL
  useEffect(() => {
    // Check location and API client
    if (!location || !apiClientRef.current) return;
    setIsLoading(true);
    setLightboxIndex(-1);
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
      } else if (SortType[SortType.nameDesc] === sessionSortType) {
        setSortType(SortType.nameDesc);
      } else if (SortType[SortType.name] === sessionSortType) {
        setSortType(SortType.name);
      }
    }

    // The pathname should be something like /gallery/path/to/subfolder
    const relativePath = location.pathname.substring(8);
    if (1 < relativePath.length) {
      // Build breadcrumbs by using .then() style instead of await due to useEffect limitation
      apiClientRef.current.generatePathBreadcrumbs(relativePath).then(segments => {
        // All good!
        setBreadcrumbs(segments);
        setFolderPath(relativePath || '/');
      }).catch(err => {
        // Path not found or unknown errors
        setFailMsg(getErrorMessage(err));
        setIsLoading(false);
      });
    } else {
      // This is root path
      console.log('Using root path.');
      setBreadcrumbs([]);
      setFolderPath('/');
    }
  }, [location, apiClientRef]);

  // Load folder content
  useEffect(() => {
    // Check API key
    if (!apiClientRef.current || !folderPath) return;

    const loadGallery = async () => {
      setFailMsg('');
      try {
        // Get folder content
        const listResult = await apiClientRef.current!.listFolder(folderPath, sortType);
        setFolderItems(listResult.folders);

        // Filter out non-images files
        const folderImages = extractImages(listResult.files);

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
        let viewableImages: FileItem[], summaryText: string;
        if (GALLERY_FIRST_LOAD_IMAGES < folderImages.length) {
          viewableImages = folderImages.slice(0, GALLERY_FIRST_LOAD_IMAGES);
          setHasMoreImage(true);
          summaryText = `${listResult.folders.length} folder(s), first ${GALLERY_FIRST_LOAD_IMAGES} of ${folderImages.length} image(s) showed, total ${listResult.files.length} file(s)`;
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
        setSummaryText(summaryText);
      } catch (ex) {
        // Error occurred?
        const errorMsg = getErrorMessage(ex);
        console.error(`Failed to load gallery: ${errorMsg}`);
        setFailMsg(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadGallery();
  }, [apiClientRef, folderPath]);

  // Download folder content when current folder content loaded
  useEffect(() => {
    // Check fetch content enabled
    if (!fetchContent || !apiClientRef.current) return;

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
      for (let b = 0; b < newImages.length; b += GALLERY_BATCH_SIZE) {
        // Make sure it is working on the same path
        if (isCancelled) {
          console.warn('Working folder path changed...');
          return;
        }

        // Get current batch
        console.log(`Fetching batch[${b}]...`);
        const batch = newImages.slice(b, b + GALLERY_BATCH_SIZE);

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
          if (ProviderType.FileLuS5Api === providerType) {
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
            if (ProviderType.FileLuS5Api === providerType || ProviderType.AwsS3Api === providerType) {
              // For S3 API, make download request
              const apiClient = apiClientRef.current as AwsS3Api;
              const res = await apiClient.makeDownloadRequest(image.code);
              if (!res.ok) {
                // Fetch failed?
                image.title = `Failed to download file content: HttpStatus=${res.status}`;
                image.thumbnail = STOP_ERROR_URL;
              } else {
                // Read as array buffer
                const fileBuffer = await res.arrayBuffer();
                fileBytes = new Uint8Array<ArrayBuffer>(fileBuffer);

                // Cache the data
                ImageCacheUtils.set(image.code, fileBytes);
                console.log(`Image downloaded: ${image.name}`);
              }
            } else {
              // For native API, request full size URL
              const apiClient = apiClientRef.current as FileLuApi;
              const linkResult = await apiClient.getFileDirectLink(image.code);
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
                    image.thumbnail = STOP_ERROR_URL;
                  }
                } else {
                  // No proxy image URL?
                  image.title = 'Unsupported FileLu URL: ' + linkResult.url;
                  image.thumbnail = STOP_ERROR_URL;
                }
              } else {
                // Not encrypted image, update full URL to target item
                image.title = `${image.name} (${toDisplaySize(linkResult.size)} / ${image.uploaded})`;
                image.src = linkResult.url;
              }
            }
          }

          // Check image binary
          if (fileBytes) {
            // Read file description, when required
            if (requestMeta && (ProviderType.FileLuS5Api === providerType || ProviderType.AwsS3Api === providerType)) {
              // For S3 API, send HEAD request for description
              const apiClient = apiClientRef.current as AwsS3Api;
              const headers = await apiClient.requestMetaData(image.code);
              if (headers) {
                const description = headers[S3_DESCRIPTION_HEADER_NAME];
                if (description) {
                  image.description = description;
                }
              }
            }

            // Check encryption is being used
            if (image.encrypted) {
              try {
                // Decrypt image
                const rawDecryptedBytes = await WCipher.decrypt(encPassword!, fileBytes),
                  decryptedBytes = rawDecryptedBytes as Uint8Array<ArrayBuffer>;

                // Trim the .enc extension, such as `image.jpg.enc` to `image.jpg`
                const fileNameWithoutEnc = image.name.substring(0, image.name.length - 4);
                const imageBlob = new Blob([decryptedBytes], { type: getBlobTypeByExtName(fileNameWithoutEnc) });
                const imageUrl = URL.createObjectURL(imageBlob);

                // Assign image data to image object
                image.title = `${fileNameWithoutEnc} (${toDisplaySize(decryptedBytes.length)} / ${image.uploaded})`;
                image.src = imageUrl;
                image.thumbnail = imageUrl;
              } catch (ex) {
                // Failed to decrypt, probably due to wrong password
                console.warn(`Failed to decrypted content: ${image.name}`, ex);
                image.thumbnail = STOP_ERROR_URL;
                shouldClearPassword = true;
              }
            } else {
              // Normal images, such as downloaded from S3
              // Use object URL for image
              const imageBlob = new Blob([fileBytes], { type: getBlobTypeByExtName(image.name) }),
                imageUrl = URL.createObjectURL(imageBlob);
              image.src = imageUrl;
              image.thumbnail = imageUrl;
              image.title = `${image.name} (${toDisplaySize(fileBytes.byteLength)} / ${image.uploaded})`;
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
        if (shouldSleep && b + GALLERY_BATCH_SIZE < newImages.length) {
          // Sleep for a while to prevent rate limiting
          await sleep(GALLERY_BATCH_SLEEP);
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

  // Sort folder content
  useEffect(() => {
    // Sort folders
    if (folderItems.length) {
      let newFolders = [...folderItems];
      if (SortType.nameDesc === sortType) {
        // Sort by name DESC
        newFolders.sort(sortByNameDesc);
      } else {
        // Sort by name ASC
        newFolders.sort(sortByNameAsc);
      }
      setFolderItems(newFolders);
    }

    // Sort images
    if (onScreenImages.length) {
      let newImages = [...allImages];
      if (SortType.uploaded === sortType) {
        // Sort by time DESC
        newImages.sort(sortByTimeDesc);
      } else if (SortType.nameDesc === sortType) {
        // Sort by name DESC
        newImages.sort(sortByNameDesc);
      } else {
        // Sort by name ASC
        newImages.sort(sortByNameAsc);
      }
      if (hasMoreImage) {
        newImages = newImages.slice(0, GALLERY_FIRST_LOAD_IMAGES);
      }
      setOnScreenImages(newImages);
      setFetchContent(true);
    }

    // Save sorting type to session
    sessionStorage.setItem('sortType', SortType[sortType]);
  }, [sortType]);

  const handleImageClick = (imageIndex: number) => {
    // Show lightbox only when image full size URLs loaded
    if (onScreenImages && imageIndex < onScreenImages.length && onScreenImages[imageIndex].src) {
      setLightboxIndex(imageIndex);
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
      newImages.sort(sortByTimeDesc);
    } else if (SortType.nameDesc === sortType) {
      // Sort by name DESC
      newImages.sort(sortByNameDesc);
    } else {
      // Sort by name ASC
      newImages.sort(sortByNameAsc);
    }
    setOnScreenImages(newImages);
    setFetchContent(true);
    setHasMoreImage(false);
    setSummaryText(`${folderItems.length} folder(s), ${newImages.length} image(s) out of ${filesInFolder} file(s)`);
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
      await apiClientRef.current?.deleteFile(targetImage.code);

      // Refresh gallery
      const newOnScreenImages = onScreenImages.filter(img => img.code !== fileCode);
      setOnScreenImages(newOnScreenImages);
      const newAllImages = allImages.filter(img => img.code !== fileCode);
      setAllImages(newAllImages);
    } catch (ex) {
      const errorMsg = getErrorMessage(ex);
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
                  linkAs={Link} linkProps={{ to: `/gallery${item.path}` }}>
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
              <Button variant="outline-primary" active={SortType.name === sortType} title="Sort by file name, ascending order"
                onClick={() => setSortType(SortType.name)}>
                <SortAlphaDown />
              </Button>
              <Button variant="outline-primary" active={SortType.nameDesc === sortType} title="Sort by file name, descending order"
                onClick={() => setSortType(SortType.nameDesc)}>
                <SortAlphaUp />
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
        {(0 !== folderItems.length || 0 !== onScreenImages.length) && <>
          <div className="gallery-view row">
            {folderItems.map(folder => (
              <div key={folder.id} className="col-6 col-md-4 col-lg-3 col-xxl-2 mb-4" title={folder.name}>
                <Link to={`/gallery${folder.path}`} className="card">
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
                captions={{ hidden: !showCaption, showToggle: true }}
                index={lightboxIndex}
                slides={onScreenImages}
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
              />
            </>}
          </div>
          {hasMoreImage && <button type="button" className="btn btn-primary w-100" disabled={fetchContent}
            onClick={() => loadRemainingImages()}>
            <Images />&nbsp;Load remaining images</button>}
        </>}
        {0 === folderItems.length && 0 === onScreenImages.length && !failMsg && <>
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
        {summaryText && <>
          <hr />
          <div className="text-body-secondary text-end">{summaryText}</div>
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
