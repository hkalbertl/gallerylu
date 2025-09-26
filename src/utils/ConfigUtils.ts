import { ProviderType, GLConfig, S3UrlStyle } from "../types/models";

export default class ConfigUtils {
  private static CONFIG_PROVIDER = "provider";
  private static CONFIG_ACCESS_ID = "accessId";
  private static CONFIG_SECRET_KEY = "secretKey";
  private static CONFIG_HOST_NAME = "hostName";
  private static CONFIG_REGION = "region";
  private static CONFIG_API_KEY = "apiKey";
  private static CONFIG_URL_STYLE = "urlStyle";

  /**
   * Load saved config from client browser.
   */
  static loadConfig = (): GLConfig => {
    let urlStyle: S3UrlStyle | undefined = undefined;
    const savedUrlStyle = localStorage.getItem(ConfigUtils.CONFIG_URL_STYLE);
    if (savedUrlStyle) {
      urlStyle = +savedUrlStyle as S3UrlStyle;
    }
    return {
      provider: localStorage.getItem(ConfigUtils.CONFIG_PROVIDER) as ProviderType,
      hostName: localStorage.getItem(ConfigUtils.CONFIG_HOST_NAME) || undefined,
      region: localStorage.getItem(ConfigUtils.CONFIG_REGION) || undefined,
      accessId: localStorage.getItem(ConfigUtils.CONFIG_ACCESS_ID) || undefined,
      secretKey: localStorage.getItem(ConfigUtils.CONFIG_SECRET_KEY) || undefined,
      apiKey: localStorage.getItem(ConfigUtils.CONFIG_API_KEY) || undefined,
      urlStyle,
    };
  };

  /**
   * Save config to client browser.
   * @param config Config values to save.
   */
  static saveConfig = (config: GLConfig) => {
    if (config.provider) localStorage.setItem(ConfigUtils.CONFIG_PROVIDER, config.provider);
    if (config.hostName) localStorage.setItem(ConfigUtils.CONFIG_HOST_NAME, config.hostName);
    if (config.region) localStorage.setItem(ConfigUtils.CONFIG_REGION, config.region);
    if (config.accessId) localStorage.setItem(ConfigUtils.CONFIG_ACCESS_ID, config.accessId);
    if (config.secretKey) localStorage.setItem(ConfigUtils.CONFIG_SECRET_KEY, config.secretKey);
    if (config.apiKey) localStorage.setItem(ConfigUtils.CONFIG_API_KEY, config.apiKey);
    if (config.urlStyle) localStorage.setItem(ConfigUtils.CONFIG_URL_STYLE, `${config.urlStyle}`);
  };
}
