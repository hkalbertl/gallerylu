import { useState, useEffect } from "react";
import { InfoCircle, ExclamationTriangle, Check2, DashCircle, Floppy, Stars, Trash } from "react-bootstrap-icons";
import { Alert, Button, Card, CardBody, CardHeader, Form, FormCheck, FormControl, FormGroup, FormLabel, InputGroup, Tab, Tabs } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ProviderType, S3UrlStyle } from "../types/models";
import { getErrorMessage } from "../utils/AppUtils";
import ConfigUtils from "../utils/ConfigUtils";
import ImageCacheUtils from "../utils/ImageCacheUtils";
import StorageProvider from "../services/StorageProvider";
import FileLuS5Api from "../services/FileLuS5Api";
import FileLuApi from "../services/FileLuApi";
import AwsS3Api from "../services/AwsS3Api";

function Config() {
  const [providerType, setProviderType] = useState<ProviderType>(ProviderType.FileLuS5Api);
  const [fileLuApiKey, setFileLuApiKey] = useState("");
  const [fileLuS5AccessId, setFileLuS5AccessId] = useState("");
  const [fileLuS5SecretKey, setFileLuS5SecretKey] = useState("");
  const [awsS3AccessId, setAwsS3AccessId] = useState("");
  const [awsS3SecretKey, setAwsS3SecretKey] = useState("");
  const [awsS3HostName, setAwsS3HostName] = useState("");
  const [awsS3Region, setAwsS3Region] = useState("");
  const [awsS3PathStyle, setAwsS3PathStyle] = useState(false);
  const [requestMeta, setRequestMeta] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load saved config when the component mounts
  useEffect(() => {
    // Load and fill config values
    const savedConfig = ConfigUtils.loadConfig(),
      provider = savedConfig.provider || ProviderType.FileLuS5Api;
    setProviderType(provider);
    if (ProviderType.FileLuS5Api === provider) {
      setFileLuS5AccessId(savedConfig.accessId || '');
      setFileLuS5SecretKey(savedConfig.secretKey || '');
    } else if (ProviderType.AwsS3Api === provider) {
      setAwsS3AccessId(savedConfig.accessId || '');
      setAwsS3SecretKey(savedConfig.secretKey || '');
      setAwsS3HostName(savedConfig.hostName || '');
      setAwsS3Region(savedConfig.region || '');
      setAwsS3PathStyle(S3UrlStyle.path === savedConfig.urlStyle);
    } else if (ProviderType.FileLuApi === provider) {
      setFileLuApiKey(savedConfig.apiKey || '');
    }
    // Other configurations
    setShowCaption(!!savedConfig.showCaption);
    setRequestMeta(!!savedConfig.requestMeta);
  }, []);

  useEffect(() => {
    if (ProviderType.FileLuS5Api !== providerType && ProviderType.AwsS3Api !== providerType) {
      setRequestMeta(false);
    }
  }, [providerType])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Set loading
      setIsLoading(true);
      setIsSuccess(false);
      setError("");

      // Check connection type
      let apiClient: StorageProvider | undefined = undefined;
      if (ProviderType.FileLuS5Api === providerType) {
        apiClient = new FileLuS5Api(fileLuS5AccessId, fileLuS5SecretKey);
      } else if (ProviderType.AwsS3Api === providerType) {
        apiClient = new AwsS3Api(awsS3AccessId, awsS3SecretKey, awsS3HostName, awsS3Region,
          awsS3PathStyle ? S3UrlStyle.path : S3UrlStyle.virtualHost);
      } else if (ProviderType.FileLuApi === providerType) {
        apiClient = new FileLuApi(fileLuApiKey);
      }
      if (!apiClient) {
        setError("Unknown connection method.");
        return;
      }

      // Validate connection
      const validationError = await apiClient.validateCredentials();
      if (validationError) {
        setError(validationError);
        return;
      }

      // Add common configs
      const newConfig = apiClient.exportConfig();
      newConfig.showCaption = showCaption;
      if (ProviderType.FileLuS5Api === providerType || ProviderType.AwsS3Api === providerType) {
        newConfig.requestMeta = requestMeta;
      } else {
        newConfig.requestMeta = false;
      }

      // Save to localStorage
      ConfigUtils.saveConfig(newConfig);

      // Clear error and show successful alert
      setError("");
      setIsSuccess(true);
    } catch (ex) {
      // Error occurred? Most likely the API is not correct
      const errorMsg = getErrorMessage(ex);
      console.error(`Error occurred? ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (confirm('Are you sure to clear all image caches?')) {
      await ImageCacheUtils.clearAll();
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure to reset everything?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="false">
      <div className="d-flex justify-content-center">
        <div className="card p-4 w-100 w-md-75 shadow" style={{ maxWidth: "640px" }}>
          <h4 className="mb-3">Configuration</h4>
          <Card className="mb-3">
            <CardHeader>Storage Providers</CardHeader>
            <CardBody>
              <Tabs id="provider-tabs" defaultActiveKey={ProviderType.FileLuS5Api} activeKey={providerType}
                onSelect={selected => setProviderType(selected as ProviderType)}>
                <Tab eventKey={ProviderType.FileLuS5Api} title="FileLu S5" className="border border-top-0 p-3">
                  <FormGroup className="mb-3" controlId="fileLuS5AccesId">
                    <FormLabel>S5 Access Key</FormLabel>
                    <FormControl value={fileLuS5AccessId} onInput={(e) => setFileLuS5AccessId(e.currentTarget.value)} />
                  </FormGroup>
                  <FormGroup className="mb-3" controlId="fileLuS5SecretKey">
                    <FormLabel>S5 Secret Key</FormLabel>
                    <FormControl type="password" value={fileLuS5SecretKey} onInput={(e) => setFileLuS5SecretKey(e.currentTarget.value)} />
                  </FormGroup>
                  <div className="d-flex justify-content-end">
                    <a href="https://github.com/hkalbertl/gallerylu/wiki/Configuration#filelu-s5">
                      <InfoCircle className="me-1" />Help
                    </a>
                  </div>
                </Tab>
                <Tab eventKey={ProviderType.FileLuApi} title="FileLu Developer API" className="border border-top-0 p-3">
                  <FormGroup className="mb-3" controlId="fileLuApiKey">
                    <FormLabel>Developer API Key</FormLabel>
                    <FormControl type="password" value={fileLuApiKey} onInput={(e) => setFileLuApiKey(e.currentTarget.value)} />
                  </FormGroup>
                  <Alert variant="warning">
                    <ExclamationTriangle /> Direct access to FileLu for unencrypted images. Encrypted images are routed through a proxy. Worried about how your files are handled? See <a href="https://github.com/hkalbertl/gallerylu/wiki/Configuration#filelu-developer-api">details</a> on how GalleryLu uses the FileLu Developer API.
                  </Alert>
                </Tab>
                <Tab eventKey={ProviderType.AwsS3Api} title="AWS S3 Compatible" className="border border-top-0 p-3">
                  <FormGroup className="mb-3" controlId="awsS3HostName">
                    <FormLabel>Host Name</FormLabel>
                    <InputGroup>
                      <InputGroup.Text>https://</InputGroup.Text>
                      <FormControl value={awsS3HostName} onInput={(e) => setAwsS3HostName(e.currentTarget.value)} />
                    </InputGroup>
                  </FormGroup>
                  <FormGroup className="mb-3" controlId="awsS3Region">
                    <FormLabel>Region</FormLabel>
                    <FormControl value={awsS3Region} onInput={(e) => setAwsS3Region(e.currentTarget.value)} placeholder="Optional" />
                  </FormGroup>
                  <FormGroup className="mb-3" controlId="awsS3AccesId">
                    <FormLabel>Access ID</FormLabel>
                    <FormControl value={awsS3AccessId} onInput={(e) => setAwsS3AccessId(e.currentTarget.value)} />
                  </FormGroup>
                  <FormGroup className="mb-3" controlId="awsS3SecretKey">
                    <FormLabel>Secret Key</FormLabel>
                    <FormControl type="password" value={awsS3SecretKey} onInput={(e) => setAwsS3SecretKey(e.currentTarget.value)} />
                  </FormGroup>
                  <div className="d-flex justify-content-between">
                    <Form.Check
                      type="switch" id="awsS3UrlStyle" label={<>Use <b>Path</b> URL Style</>}
                      checked={awsS3PathStyle} onChange={e => setAwsS3PathStyle(e.currentTarget.checked)}
                    />
                    <a href="https://github.com/hkalbertl/gallerylu/wiki/Configuration#aws-s3-compatible">
                      <InfoCircle className="me-1" />Help
                    </a>
                  </div>
                </Tab>
              </Tabs>
            </CardBody>
          </Card>
          <Card className="mb-3">
            <CardHeader>Other Configurations</CardHeader>
            <CardBody>
              <FormCheck
                type="switch" id="showCaption" className="mb-3" label="In lightbox preview, show caption by default"
                checked={showCaption} onChange={e => setShowCaption(e.target.checked)}
              />
              <FormCheck
                type="switch" id="readMeta" className="mb-3" label="Enable sending additional requests for meta data"
                title="For S3 related providers, enable GalleryLu to send additional HEAD request for meta data like description."
                disabled={ProviderType.FileLuS5Api !== providerType && ProviderType.AwsS3Api !== providerType}
                checked={requestMeta} onChange={e => setRequestMeta(e.target.checked)}
              />
            </CardBody>
          </Card>

          {!isLoading && isSuccess && <Alert variant="success">
            <Check2 /> Configuration saved successfully! Let's go to <Link to="/gallery">Gallery</Link>.
          </Alert>}
          {!isLoading && error && <Alert variant="danger">
            <DashCircle /> {error}
          </Alert>}

          <div className="d-flex gap-2">
            <Button type="submit" variant="primary" disabled={isLoading}>
              {!isLoading && <Floppy />}
              {isLoading && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
              &nbsp;Save
            </Button>
            <Button variant="outline-warning" className="ms-auto" onClick={handleClearCache}>
              <Stars />&nbsp;Clear Cache
            </Button>
            <Button variant="outline-danger" onClick={handleReset}>
              <Trash />&nbsp;Reset
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default Config;
