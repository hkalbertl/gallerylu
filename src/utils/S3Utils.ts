import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { XMLParser } from "fast-xml-parser";
import { DateTimeDisplayFormat, FileItem, FolderItem, ListFolderResult, SortType } from "../types/models";
import AppUtils from "./AppUtils";

// Load plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export default class S3Utils {

  private static S3_PROTOCOL = "https";
  private static S3_HOSTNAME = "s5lu.com";
  private static S3_REGION = "global";

  /**
   * Create signature V4 used for S3 requests.
   * @param accessId S3 Access ID.
   * @param secretKey S3 Secret Key.
   */
  private static createSignature = (accessId: string, secretKey: string) => {
    return new SignatureV4({
      credentials: {
        accessKeyId: accessId,
        secretAccessKey: secretKey,
      },
      region: S3Utils.S3_REGION,
      service: "s3",
      sha256: Sha256,
    });
  };

  /**
   * Create and send signed request to S3 server.
   * @param accessId S3 Access ID.
   * @param secretKey S3 Secret Key.
   * @param path The target file path, included bucket name. Such as `TestS3/Inner/Sub/image4.jpg`.
   * @param query Optional. Additional query string parameters.
   * @param method Optional HTTP request method. Default is `GET`.
   * @returns The HTTP response object.
   */
  static makeSignedRequest = async (accessId: string, secretKey: string, path: string, query?: Record<string, string>, method: string = 'GET') => {
    // Create signature and sign the request
    const signer = S3Utils.createSignature(accessId, secretKey);
    const request = new HttpRequest({
      protocol: S3Utils.S3_PROTOCOL,
      hostname: S3Utils.S3_HOSTNAME,
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

  /**
   * Get available bucket names.
   * @param accessId S3 Access ID.
   * @param secretKey S3 Secret Key.
   * @returns An array of bucket names.
   */
  static listBuckets = async (accessId: string, secretKey: string): Promise<string[]> => {
    const res = await S3Utils.makeSignedRequest(accessId, secretKey, "/", { "x-id": "ListBuckets" });
    const rawXml = await res.text();
    const parser = new XMLParser();
    const result = parser.parse(rawXml);
    const buckets = result?.ListAllMyBucketsResult?.Buckets?.Bucket || [];
    return Array.isArray(buckets) ? buckets.map((b) => b.Name) : [buckets.Name];
  };

  /**
   * Get folder content by specified path.
   * @param accessId S3 Access ID.
   * @param secretKey S3 Secret Key.
   * @param bucketName Bucket name. Such as `TestS3`.
   * @param subPath The path to target folder. Such as `Inner/Sub`
   * @param sortType The file sorting type.
   * @returns The files and sub-folders of target folder.
   */
  static listBucketContent = async (accessId: string, secretKey: string, bucketName: string, subPath: string, sortType: SortType): Promise<ListFolderResult> => {
    let prefix = subPath || '';
    if (prefix && !prefix.endsWith('/')) {
      prefix += '/';
    }
    const res = await S3Utils.makeSignedRequest(accessId, secretKey, `/${bucketName}`, {
      "list-type": "2",
      delimiter: "/",
      prefix,
    });
    const rawXml = await res.text();
    return S3Utils.parseListObjects(bucketName, sortType, rawXml);
  };

  /**
   * Get the file name by specified path.
   * @param path The path to file.
   * @returns The file name.
   */
  private static getFileNameFromPath = (path: string): string => {
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
  private static parseListObjects = (bucketName: string, sortType: SortType, xml: string): ListFolderResult => {
    const parser = new XMLParser();
    const result = parser.parse(xml);

    const listPrefix: string = result?.ListBucketResult?.Prefix ?? '';
    const contents = result?.ListBucketResult?.Contents ?? [];
    const commonPrefixes = result?.ListBucketResult?.CommonPrefixes ?? [];

    const files: FileItem[] = (Array.isArray(contents) ? contents : [contents])
      .filter(Boolean)
      .map((c: any) => {
        // The file key is something like `Inner/Sub/image4.jpg`
        const relativePath = `${bucketName}/${c.Key as string}`,
          fileName = S3Utils.getFileNameFromPath(relativePath),
          localTime = dayjs(c.LastModified).tz(dayjs.tz.guess());
        const fileItem = {
          code: relativePath,
          name: fileName,
          uploaded: localTime.format(DateTimeDisplayFormat),
        } as FileItem;
        fileItem.title = `${fileItem.name} (${fileItem.uploaded})`;
        // Check if current file is encrypted
        if (fileItem.name.endsWith('.enc')) {
          fileItem.encrypted = true;
        }
        return fileItem;
      });
    if (SortType.uploaded === sortType) {
      files.sort(AppUtils.sortByTimeDesc);
    } else {
      files.sort(AppUtils.sortByNameAsc);
    }

    const folders: FolderItem[] = (
      Array.isArray(commonPrefixes) ? commonPrefixes : [commonPrefixes]
    )
      .filter(Boolean)
      .map((p: any, index: number) => {
        // The folder prefix is something like `Inner/Sub/`
        const relativePath = (p.Prefix as string).slice(0, -1);
        const folderItem = {
          id: index,
          name: relativePath.substring(listPrefix.length),
          navPath: `/gallery/${bucketName}/${relativePath}`,
        } as FolderItem;
        return folderItem;
      });

    return { folderId: 0, files, folders };
  }

  /**
   * Create and send file download request.
   * @param accessId S3 Access ID.
   * @param secretKey S3 Secret Key.
   * @param relativePath The relative path to target file. Such as `TestS3/Inner/Sub/image4.jpg`.
   * @returns
   */
  static makeDownloadRequest = async (accessId: string, secretKey: string, relativePath: string): Promise<Response> => {
    return await S3Utils.makeSignedRequest(accessId, secretKey, `/${relativePath}`);
  };

  /**
   * Delete a file by relative path.
   * @param accessId S3 Access ID.
   * @param secretKey S3 Secret Key.
   * @param relativePath The relative path to target file. Such as `TestS3/Inner/Sub/image4.jpg`.
   * @returns
   */
  static deleteFile = async (accessId: string, secretKey: string, relativePath: string): Promise<boolean> => {
    let error: string;
    try {
      const res = await S3Utils.makeSignedRequest(accessId, secretKey, relativePath, undefined, 'DELETE');
      if (res.ok) {
        // File deleted
        return true;
      } else {
        // Non-success request?
        const content = await res.text();
        error = `Unknown API response (status: ${res.status}): ${content}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${AppUtils.getErrorMessage(ex)}`;
    }
    throw error;
  }
}
