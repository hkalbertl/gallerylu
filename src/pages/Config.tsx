import { useState, useEffect } from "react";
import { InfoCircle, ExclamationTriangle, Square, Check2Square, Check2, DashCircle, Floppy, Stars, Trash, BoxArrowUpRight } from "react-bootstrap-icons";
import { Accordion, Alert, Button, Form, FormControl, FormGroup, FormLabel, InputGroup } from "react-bootstrap";
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
  const [awsS3VirtualHostStyle, setAwsS3VirtualHostStyle] = useState(false);
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
      setAwsS3VirtualHostStyle(S3UrlStyle.virtualHost === savedConfig.urlStyle);
    } else {
      setFileLuApiKey(savedConfig.apiKey || '');
    }
  }, []);

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
          awsS3VirtualHostStyle ? S3UrlStyle.virtualHost : S3UrlStyle.path);
      } else if (ProviderType.FileLuApi === providerType) {
        apiClient = new FileLuApi(fileLuApiKey);
      }
      debugger;
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

      // Save to localStorage
      const newConfig = apiClient.exportConfig();
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

          <p className="mb-3">
            Please choose one of the following connection method to access your images. If you are using FileLu, please enable <b>S5 Object Storage</b> or <b>Developer API Key</b> in the FileLu <a href="https://filelu.com/account/" target="_blank">My Account</a> page.
            If you are new to FileLu, consider registering using the author's <a href="https://filelu.com/5155514948.html" target="_blank">referral link</a>.
          </p>

          <Accordion className="mb-3" defaultActiveKey={ProviderType.FileLuS5Api} activeKey={providerType}>
            <Accordion.Item eventKey={ProviderType.FileLuS5Api}>
              <Accordion.Header onClick={() => { setProviderType(ProviderType.FileLuS5Api) }}>
                {ProviderType.FileLuS5Api === providerType ? <Check2Square /> : <Square />}
                &nbsp;Using FileLu S5
              </Accordion.Header>
              <Accordion.Body>
                <FormGroup className="mb-3" controlId="fileLuS5AccesId">
                  <FormLabel>S5 Access Key</FormLabel>
                  <FormControl value={fileLuS5AccessId} onInput={(e) => setFileLuS5AccessId(e.currentTarget.value)} />
                </FormGroup>
                <FormGroup className="mb-3" controlId="fileLuS5SecretKey">
                  <FormLabel>S5 Secret Key</FormLabel>
                  <FormControl type="password" value={fileLuS5SecretKey} onInput={(e) => setFileLuS5SecretKey(e.currentTarget.value)} />
                </FormGroup>
                <Alert variant="info">
                  <InfoCircle /> Please note that free FileLu accounts support only one bucket.
                </Alert>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey={ProviderType.FileLuApi}>
              <Accordion.Header onClick={() => { setProviderType(ProviderType.FileLuApi) }}>
                {ProviderType.FileLuApi === providerType ? <Check2Square /> : <Square />}
                &nbsp;Using FileLu Native API
              </Accordion.Header>
              <Accordion.Body>
                <FormGroup className="mb-3" controlId="fileLuApiKey">
                  <FormLabel>FileLu API Key</FormLabel>
                  <FormControl type="password" value={fileLuApiKey} onInput={(e) => setFileLuApiKey(e.currentTarget.value)} />
                </FormGroup>
                <Alert variant="warning">
                  <ExclamationTriangle /> Using the FileLu native API allows users to download files directly from its server. Unfortunately, the FileLu server always sets the <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors" target="_blank">CORS origin</a> to its own domain, so modern web browsers will block these requests and prevent GalleryLu from displaying images. To bypass this restriction, a Vercel web proxy is used to transfer files between the FileLu server and the client's web browser. If you are <b>concerned</b> about your files being <b>read by third parties</b>, consider using <b>FileLu S5</b> instead.
                </Alert>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey={ProviderType.AwsS3Api}>
              <Accordion.Header onClick={() => { setProviderType(ProviderType.AwsS3Api) }}>
                {ProviderType.AwsS3Api === providerType ? <Check2Square /> : <Square />}
                &nbsp;Using AWS S3 Compatible
              </Accordion.Header>
              <Accordion.Body>
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
                <Form.Check
                  type="switch" id="awsS3UrlStyle" label={<>Use <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html#virtual-hosted-style-access" target="_blank">Virtual Host <BoxArrowUpRight /></a> URL Style</>}
                  checked={awsS3VirtualHostStyle} onChange={e => setAwsS3VirtualHostStyle(e.currentTarget.checked)}
                />
                <Alert variant="info">
                  <InfoCircle />&nbsp;When using AWS S3 Compatible provider, please make sure your bucket defined the correct CORS headers to allow GalleryLu to access correctly. For example:
                  <ul>
                    <li>Access-Control-Allow-Origin: {location.origin}</li>
                    <li>Access-Control-Allow-Methods: GET, DELETE, HEAD</li>
                  </ul>
                </Alert>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>

          {!isLoading && isSuccess && <Alert variant="success">
            <Check2 /> Configuration saved successfully! Let's go to <Link to="/gallery">Gallery</Link>.
          </Alert>}
          {!isLoading && error && <Alert variant="danger">
            <DashCircle /> {error}
          </Alert>}

          <div className="d-flex">
            <Button type="submit" variant="primary" disabled={isLoading}>
              {!isLoading && <Floppy />}
              {isLoading && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
              &nbsp;Save
            </Button>
            <Button variant="outline-warning" className="ms-auto" onClick={handleClearCache}>
              <Stars />&nbsp;Clear Cache
            </Button>
            <Button variant="outline-danger" className="ms-1" onClick={handleReset}>
              <Trash />&nbsp;Reset
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default Config;
