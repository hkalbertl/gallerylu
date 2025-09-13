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

  static createSignature = (accessId: string, secretKey: string) => {
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

  static makeSignedRequest = async (accessId: string, secretKey: string, path: string, query?: Record<string, string>, httpMethod: string = 'GET') => {
    const signer = S3Utils.createSignature(accessId, secretKey);
    const request = new HttpRequest({
      protocol: S3Utils.S3_PROTOCOL,
      hostname: S3Utils.S3_HOSTNAME,
      method: httpMethod,
      path,
      query,
    });
    const signed = await signer.sign(request);
    let url = `${signed.protocol}//${signed.hostname}${signed.path}`;
    if (query && signed.query) {
      url += `?${new URLSearchParams(
        signed.query as Record<string, string>
      ).toString()}`;
    }
    return await fetch(url, {
      method: signed.method,
      headers: signed.headers,
    });
  };

  static listBuckets = async (accessId: string, secretKey: string): Promise<string[]> => {
    const res = await S3Utils.makeSignedRequest(accessId, secretKey, "/", { "x-id": "ListBuckets" });
    const rawXml = await res.text();
    const parser = new XMLParser();
    const result = parser.parse(rawXml);
    const buckets = result?.ListAllMyBucketsResult?.Buckets?.Bucket || [];
    return Array.isArray(buckets) ? buckets.map((b) => b.Name) : [buckets.Name];
  };

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

  static getFileNameFromPath = (path: string): string => {
    const lastSlash = path.lastIndexOf('/');
    if (-1 !== lastSlash) {
      return path.substring(lastSlash + 1);
    }
    return path;
  };

  static parseListObjects = (bucketName: string, sortType: SortType, xml: string): ListFolderResult => {
    const parser = new XMLParser();
    const result = parser.parse(xml);

    const listPrefix: string = result?.ListBucketResult?.Prefix ?? '';
    const contents = result?.ListBucketResult?.Contents ?? [];
    const commonPrefixes = result?.ListBucketResult?.CommonPrefixes ?? [];

    const files: FileItem[] = (Array.isArray(contents) ? contents : [contents])
      .filter(Boolean)
      .map((c: any) => {
        // The file key is something like Inner/Sub/image4.jpg
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
        // The folder prefix is something like Inner/Sub/
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

  static makeDownloadRequest = async (accessId: string, secretKey: string, relativePath: string): Promise<Response> => {
    return await S3Utils.makeSignedRequest(accessId, secretKey, `/${relativePath}`);
  };

  static deleteFile = async (accessId: string, secretKey: string, relativePath: string): Promise<boolean> => {
    const res = await S3Utils.makeSignedRequest(accessId, secretKey, relativePath, undefined, 'DELETE');
    if (res.ok) {
      return true;
    } else {
      const content = await res.text();
      throw `Unknown API response (status: ${res.status}): ${content}`;
    }
  }
}
