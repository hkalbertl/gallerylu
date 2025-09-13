import { useState, useEffect } from "react";
import { InfoCircle, ExclamationTriangle, Square, Check2Square, Check2, DashCircle, Floppy, Stars, Trash } from "react-bootstrap-icons";
import { Accordion } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ConnectionMode, GLConfig } from "../types/models";
import ApiUtils from "../utils/ApiUtils";
import AppUtils from "../utils/AppUtils";
import ConfigUtils from "../utils/ConfigUtils";
import ImageCacheUtils from "../utils/ImageCacheUtils";
import S3Utils from "../utils/S3Utils";

function Config() {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(ConnectionMode.s3);
  const [apiKey, setApiKey] = useState("");
  const [s3Id, setS3Id] = useState("");
  const [s3Secret, setS3Secret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load saved config when the component mounts
  useEffect(() => {
    // Load and fill config values
    const savedConfig = ConfigUtils.loadConfig();
    setS3Id(savedConfig.s3Id);
    setS3Secret(savedConfig.s3Secret);
    setApiKey(savedConfig.apiKey);

    if (!savedConfig.s3Id && !savedConfig.s3Secret && savedConfig.apiKey) {
      // Set FileLu API active if S3 is not used
      setConnectionMode(ConnectionMode.api);
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Set loading
      setIsLoading(true);

      // Check connection type
      const newConfig: GLConfig = {
        s3Id: '',
        s3Secret: '',
        apiKey: '',
      };
      if (ConnectionMode.s3 === connectionMode) {
        // Validate S3 config
        const buckets = await S3Utils.listBuckets(s3Id, s3Secret);
        if (!buckets || !buckets.length) {
          setError("Failed to load buckets or no buckets available.");
          return;
        }

        // S3 config is valid
        newConfig.s3Id = s3Id;
        newConfig.s3Secret = s3Secret;
      } else {
        // Check API key defined
        if (!apiKey.trim()) {
          setError("API Key cannot be empty!");
          return;
        }
        // Validate API key
        await ApiUtils.validateApiKey(apiKey);

        // API key is valid
        newConfig.apiKey = apiKey;
      }

      // Save to localStorage
      ConfigUtils.saveConfig(newConfig);

      // Clear error and show successful alert
      setError("");
      setIsSuccess(true);
    } catch (ex) {
      // Error occurred? Most likely the API is not correct
      const errorMsg = AppUtils.getErrorMessage(ex);
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
    <>
      <form onSubmit={handleSubmit} autoComplete="false">
        <div className="d-flex justify-content-center">
          <div className="card p-4 w-100 w-md-75 shadow" style={{ maxWidth: "640px" }}>
            <h4 className="mb-3">Configuration</h4>

            <p className="mb-3">
              You can use <b>either</b> FileLu S5 or its native API key to access images. Please enable one of them on the FileLu <a href="https://filelu.com/account/" target="_blank">My Account</a> page.
              If you are new to FileLu, consider registering using the author's <a href="https://filelu.com/5155514948.html" target="_blank">referral link</a>.
            </p>

            <Accordion className="mb-3" defaultActiveKey={ConnectionMode.s3} activeKey={connectionMode}>
              <Accordion.Item eventKey={ConnectionMode.s3}>
                <Accordion.Header onClick={() => { setConnectionMode(ConnectionMode.s3) }}>
                  {ConnectionMode.s3 === connectionMode ? <Check2Square /> : <Square />}
                  &nbsp;Using FileLu S5
                  <span className="badge text-bg-info ms-1">AWS S3 compatible provider</span>
                </Accordion.Header>
                <Accordion.Body>
                  <div className="mb-3">
                    <label htmlFor="s3Id" className="form-label">Access Key ID</label>
                    <input type="text" id="s3Id" className="form-control" value={s3Id} onInput={(e) => setS3Id(e.currentTarget.value)} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="s3Key" className="form-label">Secret Access Key</label>
                    <input type="password" id="s3Key" className="form-control" value={s3Secret} onInput={(e) => setS3Secret(e.currentTarget.value)} />
                  </div>
                  <div className="alert alert-info">
                    <InfoCircle /> Please note that free FileLu accounts support only one bucket.
                  </div>
                </Accordion.Body>
              </Accordion.Item>
              <Accordion.Item eventKey={ConnectionMode.api}>
                <Accordion.Header onClick={() => { setConnectionMode(ConnectionMode.api) }}>
                  {ConnectionMode.api === connectionMode ? <Check2Square /> : <Square />}
                  &nbsp;Using FileLu Native API
                </Accordion.Header>
                <Accordion.Body>
                  <div className="mb-3">
                    <label htmlFor="apiKey" className="form-label">FileLu API Key</label>
                    <input type="password"
                      id="apiKey"
                      className="form-control"
                      value={apiKey}
                      onInput={(e) => setApiKey(e.currentTarget.value)} />
                  </div>
                  <div className="alert alert-warning">
                    <ExclamationTriangle /> Using the FileLu native API allows users to download files directly from its server. Unfortunately, the FileLu server always sets the <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors" target="_blank">CORS origin</a> to its own domain, so modern web browsers will block these requests and prevent GalleryLu from displaying images. To bypass this restriction, a Vercel web proxy is used to transfer files between the FileLu server and the client's web browser. If you are <b>concerned</b> about your files being <b>read by third parties</b>, consider using <b>FileLu S5</b> instead.
                  </div>
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>

            {!isLoading && isSuccess && <div className="alert alert-success">
              <Check2 /> Configuration saved successfully! Let's go to <Link to="/gallery">Gallery</Link>.
            </div>}
            {!isLoading && error && <div className="alert alert-danger">
              <DashCircle /> {error}
            </div>}

            <div className="d-flex">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {!isLoading && <Floppy />}
                {isLoading && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
                &nbsp;Save
              </button>
              <button type="button" className="btn btn-outline-warning ms-auto" onClick={handleClearCache}>
                <Stars />&nbsp;Clear Cache
              </button>
              <button type="button" className="btn btn-outline-danger ms-1" onClick={handleReset}>
                <Trash />
                &nbsp;Reset
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

export default Config;
