import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";
import { XMLParser } from "fast-xml-parser";
import { DATE_TIME_DISPLAY_FORMAT } from "../constants/common";
import StorageProvider from "./StorageProvider";
import { getErrorMessage, sortByNameAsc, sortByTimeDesc } from "../utils/AppUtils";
import { SortType, ListFolderResult, GLConfig, ProviderType, FileItem, FolderItem, S3UrlStyle } from "../types/models";

// Load plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * AWS S3 client.
 */
export default class AwsS3Api implements StorageProvider {

  protected static readonly S3_PROTOCOL = "https";

  protected readonly accessId: string;
  protected readonly secretKey: string;
  protected readonly hostName: string;
  protected readonly region?: string;
  protected readonly urlStyle?: S3UrlStyle;

  /**
   * Create new AWS S3 API client.
   */
  constructor(accessId?: string, secretKey?: string, hostName?: string, region?: string, urlStyle?: S3UrlStyle) {
    if (!hostName || 0 === hostName.trim().length) {
      throw new Error('Host Name is mandatory!');
    } else if (!accessId || 0 === accessId.trim().length) {
      throw new Error('Access ID is mandatory!');
    } else if (!secretKey || 0 === secretKey.trim().length) {
      throw new Error('Secret Key is mandatory!');
    }
    this.accessId = accessId.trim();
    this.secretKey = secretKey.trim();
    this.hostName = hostName.trim();
    this.region = region?.trim();
    this.urlStyle = urlStyle || S3UrlStyle.path;
  }

  provider = ProviderType.AwsS3Api;

  exportConfig(): GLConfig {
    return {
      provider: ProviderType.AwsS3Api,
      hostName: this.hostName,
      region: this.region,
      accessId: this.accessId,
      secretKey: this.secretKey,
      urlStyle: this.urlStyle,
    };
  }

  async validateCredentials(): Promise<string | undefined> {
    let errorMessage: string | undefined;
    try {
      const res = await this.makeListBucketsRequest();
      if (res.ok) {
        // All good!
        errorMessage = undefined;
      } else {
        // Use the status code + text as error message
        errorMessage = `HTTP Error - Status ${res.status}: ${res.statusText}`;
        // Try to extract the error message
        const rawXml = await res.text(),
          xmlErrorMessage = AwsS3Api.extractXmlError(rawXml);
        if (xmlErrorMessage) {
          // Replace the error message with extracted message when found
          errorMessage = `Error message from server: ${xmlErrorMessage}`;
        }
      }
    } catch (ex) {
      // Error occurred, probably invalid host / CORS problems
      if (ex instanceof TypeError) {
        // Network or CORS error?
        errorMessage = `Failed to connect to ${this.hostName}. Pleaes double check the Host Name and bucket CORS settings.`;
      } else {
        // Unknown error
        console.error(`Failed to validate credentials to ${this.hostName}:`, ex);
        errorMessage = getErrorMessage(ex);
      }
    }
    return errorMessage;
  }

  async listFolder(path: string, sortType: SortType): Promise<ListFolderResult> {
    const isUsingPathStyle = this.urlStyle === S3UrlStyle.path;
    if (isUsingPathStyle && (!path || 1 === path.length)) {
      // For path style and querying root directory, return the bucket list
      const buckets = await this.listBuckets();
      return {
        folderId: 0,
        folders: buckets.map(name => ({
          id: 0,
          name,
          path: `/${name}`,
        })),
        files: [],
      };
    }
    // Get bucket content
    let bucketName = '', contentPath = '';
    if (isUsingPathStyle) {
      const slashAfterBucket = path.indexOf('/', 1);
      if (-1 === slashAfterBucket) {
        // Bucket root, such as /TestS3
        bucketName = path.substring(1);
      } else {
        // Sub folder of bucket, such as /TestS3/Inner
        bucketName = path.substring(1, slashAfterBucket);
        contentPath = path.substring(slashAfterBucket + 1);
      }
    } else {
      // Virtual host style, use the path directly
      contentPath = path.substring(1);
    }
    return await this.listBucketContent(bucketName, contentPath, sortType);
  }

  async generatePathBreadcrumbs(folderPath: string): Promise<FolderItem[]> {
    return new Promise((resolve, reject) => {
      try {
        let currentPath = '';
        const pathSegments = folderPath.substring(1).split('/');
        const segments: FolderItem[] = [];
        for (let segment of pathSegments) {
          currentPath += `/${segment}`;
          segments.push({
            id: 0,
            name: segment,
            path: currentPath,
          });
        }
        resolve(segments);
      } catch (ex) {
        reject(ex);
      }
    });
  }

  /**
     * Get available bucket names.
     * @param accessId S3 Access ID.
     * @param secretKey S3 Secret Key.
     * @returns An array of bucket names.
     */
  async listBuckets(): Promise<string[]> {
    const res = await this.makeListBucketsRequest();
    const rawXml = await res.text();
    const parser = new XMLParser();
    const result = parser.parse(rawXml);
    const buckets = result?.ListAllMyBucketsResult?.Buckets?.Bucket || [];
    return Array.isArray(buckets) ? buckets.map((b) => b.Name) : [buckets.Name];
  };

  async deleteFile(remotePath: string): Promise<void> {
    let error: string;
    try {
      const res = await this.makeSignedRequest(remotePath, undefined, 'DELETE');
      if (res.ok) {
        // File deleted
        return;
      } else {
        // Non-success request?
        const content = await res.text();
        error = `Unknown API response (status: ${res.status}): ${content}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${getErrorMessage(ex)}`;
    }
    throw error;
  };

  /**
   * Create and send file download request.
   * @param relativePath The relative path to target file. Such as `TestS3/Inner/Sub/image4.jpg`.
   * @returns
   */
  async makeDownloadRequest(relativePath: string): Promise<Response> {
    return await this.makeSignedRequest(`/${relativePath}`);
  };

  /**
   * Get folder content by specified path.
   * @param bucketName Bucket name. Such as `TestS3`.
   * @param subPath The path to target folder. Such as `Inner/Sub`
   * @param sortType The file sorting type.
   * @returns The files and sub-folders of target folder.
   */
  async listBucketContent(bucketName: string, subPath: string, sortType: SortType): Promise<ListFolderResult> {
    let prefix = subPath || '';
    if (prefix && !prefix.endsWith('/')) {
      prefix += '/';
    }
    if (!bucketName && 1 >= prefix.length) {
      prefix = '';
    }
    const res = await this.makeSignedRequest(`/${bucketName}`, {
      "list-type": "2",
      delimiter: "/",
      prefix,
    });
    const rawXml = await res.text();
    return AwsS3Api.parseListObjects(bucketName, sortType, rawXml);
  };

  /**
   * Create signature V4 used for S3 requests.
   */
  private createSignature() {
    return new SignatureV4({
      credentials: {
        accessKeyId: this.accessId || '',
        secretAccessKey: this.secretKey || '',
      },
      region: this.region || '',
      service: "s3",
      sha256: Sha256,
    });
  }

  /**
   * Create and send signed request to S3 server.
   * @param path The target file path, included bucket name. Such as `TestS3/Inner/Sub/image4.jpg`.
   * @param query Optional. Additional query string parameters.
   * @param method Optional HTTP request method. Default is `GET`.
   * @returns The HTTP response object.
   */
  private async makeSignedRequest(path: string, query?: Record<string, string>, method: string = 'GET') {
    // Create signature and sign the request
    const signer = this.createSignature();
    const request = new HttpRequest({
      protocol: AwsS3Api.S3_PROTOCOL,
      hostname: this.hostName,
      headers: {
        host: this.hostName!,
        origin: location.origin,
      },
      method,
      path,
      query,
    });
    const signed = await signer.sign(request);

    // Build the request URL
    let url = `${signed.protocol}//${signed.hostname}${signed.path}`;
    if (query && signed.query) {
      url += `?${new URLSearchParams(
        signed.query as Record<string, string>
      ).toString()}`;
    }

    // Submit request by fetch
    return await fetch(url, {
      method: signed.method,
      headers: signed.headers,
    });
  };

  private async makeListBucketsRequest(): Promise<Response> {
    return await this.makeSignedRequest("/", { "x-id": "ListBuckets" });
  };

  /**
   * Get the file name by specified path.
   * @param path The path to file.
   * @returns The file name.
   */
  private static getFileNameFromPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    if (-1 !== lastSlash) {
      return path.substring(lastSlash + 1);
    }
    return path;
  };

  /**
   * Parse the S3 response XML of files and folders.
   * @param bucketName Bucket name. Such as `TestS3`.
   * @param sortType The file sorting type.
   * @param xml S3 response XML.
   * @returns The parsed files and sub-folders details.
   */
  private static parseListObjects(bucketName: string, sortType: SortType, xml: string): ListFolderResult {
    const parser = new XMLParser();
    const result = parser.parse(xml);

    const listPrefix: string = result?.ListBucketResult?.Prefix ?? '';
    const contents = result?.ListBucketResult?.Contents ?? [];
    const commonPrefixes = result?.ListBucketResult?.CommonPrefixes ?? [];

    const files: FileItem[] = (Array.isArray(contents) ? contents : [contents])
      .filter(Boolean)
      .map((c: any) => {
        // The file key is something like `Inner/Sub/image4.jpg`
        const folderName = c.Key as string,
          relativePath = bucketName ? `${bucketName}/${folderName}` : folderName,
          fileName = AwsS3Api.getFileNameFromPath(relativePath),
          localTime = dayjs(c.LastModified).tz(dayjs.tz.guess());
        const fileItem = {
          code: relativePath,
          name: fileName,
          uploaded: localTime.format(DATE_TIME_DISPLAY_FORMAT),
        } as FileItem;
        fileItem.title = `${fileItem.name} (${fileItem.uploaded})`;
        // Check if current file is encrypted
        if (fileItem.name.endsWith('.enc')) {
          fileItem.encrypted = true;
        }
        return fileItem;
      });
    if (SortType.uploaded === sortType) {
      files.sort(sortByTimeDesc);
    } else {
      files.sort(sortByNameAsc);
    }

    const folders: FolderItem[] = (
      Array.isArray(commonPrefixes) ? commonPrefixes : [commonPrefixes]
    )
      .filter(Boolean)
      .map((p: any, index: number) => {
        // The folder prefix is something like `Inner/Sub/`
        const relativePath = (p.Prefix as string).slice(0, -1);
        const folderItem: FolderItem = {
          id: index,
          name: relativePath.substring(listPrefix.length),
          path: bucketName ? `/${bucketName}/${relativePath}` : `/${relativePath}`,
        };
        return folderItem;
      });

    return { folderId: 0, files, folders };
  }

  /**
   * Extract the error message from AWS S3 response.
   * @param rawXml AWS S3 response XML.
   * @returns The extracted error message, or undefined when failed.
   */
  private static extractXmlError(rawXml: string): string | undefined {
    try {
      const parser = new XMLParser({ ignoreDeclaration: true });
      const parsed = parser.parse(rawXml);
      if (parsed?.Error?.Message) {
        return parsed?.Error?.Message as string;
      }
    } catch (ex) {
      console.error(`Failed to extract XML error: ${getErrorMessage(ex)}`);
    }
    return undefined;
  };
}
