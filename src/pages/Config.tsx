import { useState, useEffect } from "react";
import { Check2, DashCircle, Floppy, Stars, Trash } from "react-bootstrap-icons";
import ApiUtils from "../utils/ApiUtils";
import AppUtils from "../utils/AppUtils";
import ImageCacheUtils from "../utils/ImageCacheUtils";


function Config() {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load API Key from localStorage when the component mounts
  useEffect(() => {
    const rawApiKey = localStorage.getItem("apiKey");
    if (rawApiKey) {
      setApiKey(rawApiKey);
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Set loading
      setIsLoading(true);

      // Check API key defined
      if (!apiKey.trim()) {
        setError("API Key cannot be empty!");
        return;
      }

      // Validate API key
      await ApiUtils.validateApiKey(apiKey);

      // Save to localStorage
      localStorage.setItem("apiKey", apiKey);

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
            <h5 className="mb-3">Configuration</h5>
            <div className="mb-3">
              <label htmlFor="apiKey" className="form-label">FileLu API Key</label>
              <input type="password"
                id="apiKey"
                className="form-control"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)} />
              <div className="form-text">
                Enable it in FileLu <a href="https://filelu.com/account/" target="_blank">My Account</a> page.
              </div>
              <div className="form-text">
                New to FileLu? Consider to register by using author's <a href="https://filelu.com/5155514948.html"
                  target="_blank">referral link</a>.
              </div>
            </div>
            {!isLoading && isSuccess && <div className="alert alert-success">
              <Check2 /> Configuration saved successfully!
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
