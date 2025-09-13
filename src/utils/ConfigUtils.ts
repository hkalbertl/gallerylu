import { GLConfig } from "../types/models";

export default class ConfigUtils {
  private static CONFIG_S3_ID = "s3Id";
  private static CONFIG_S3_SECRET = "s3Secret";
  private static CONFIG_API_KEY = "apiKey";

  /**
   * Load saved config from client browser.
   */
  static loadConfig = (): GLConfig => {
    return {
      s3Id: localStorage.getItem(ConfigUtils.CONFIG_S3_ID) || '',
      s3Secret: localStorage.getItem(ConfigUtils.CONFIG_S3_SECRET) || '',
      apiKey: localStorage.getItem(ConfigUtils.CONFIG_API_KEY) || '',
    };
  };

  /**
   * Save config to client browser.
   * @param config Config values to save.
   */
  static saveConfig = (config: GLConfig) => {
    localStorage.setItem(ConfigUtils.CONFIG_S3_ID, config.s3Id);
    localStorage.setItem(ConfigUtils.CONFIG_S3_SECRET, config.s3Secret);
    localStorage.setItem(ConfigUtils.CONFIG_API_KEY, config.apiKey);
  };

}
