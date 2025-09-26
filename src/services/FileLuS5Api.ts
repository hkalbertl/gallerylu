import { ProviderType, GLConfig, S3UrlStyle } from "../types/models";
import AwsS3Api from "./AwsS3Api";

/**
 * FileLu S5 Object Storage API client (based on AWS S3).
 */
export default class FileLuS5Api extends AwsS3Api {

  private static readonly S5_HOSTNAME = "s5lu.com";
  private static readonly S5_REGION = "global";
  private static readonly S5_URL_STYLE = S3UrlStyle.path;

  constructor(
    accessId?: string,
    secretKey?: string,
  ) {
    if (!accessId || !accessId.trim().length) {
      throw new Error('S5 Access Key is mandatory!');
    } else if (!secretKey || !secretKey.trim().length) {
      throw new Error('S5 Secret Key is mandatory!');
    }
    super(accessId, secretKey, FileLuS5Api.S5_HOSTNAME, FileLuS5Api.S5_REGION, FileLuS5Api.S5_URL_STYLE);
  }

  override readonly provider = ProviderType.FileLuS5Api;

  exportConfig(): GLConfig {
    return {
      provider: ProviderType.FileLuS5Api,
      accessId: this.accessId,
      secretKey: this.secretKey,
    };
  }
}
