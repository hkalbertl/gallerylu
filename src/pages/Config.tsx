import { useState, useEffect } from "react";
import FileLu from "../utils/FileLu";
import GalleryLu from "../utils/Common";

function Config() {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Load API Key from localStorage when the component mounts
  useEffect(() => {
    const savedKey = localStorage.getItem("apiKey");
    if (savedKey) setApiKey(savedKey);
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
      await FileLu.validateApiKey(apiKey);

      // Save API Key to localStorage
      localStorage.setItem("apiKey", apiKey);

      setError(""); // Clear error if successful
      alert("API Key saved successfully!");
    } catch (ex) {
      const errorMsg = GalleryLu.getErrorMessage(ex);
      console.error('Error occurred?', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure to reset everything?')) {
      localStorage.clear(); // Clear all stored data
      window.location.reload(); // Reload the page to apply changes
    }
  };

  return (
    <>
      <h2>Configuration</h2>
      <form onSubmit={handleSubmit} autoComplete="false">
        <div className="mb-3">
          <label htmlFor="apiKey" className="form-label">
            API Key
          </label>
          <input
            type="password"
            id="apiKey"
            className="form-control"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {!isLoading && error && <div className="text-danger mt-2">{error}</div>}
        </div>
        <div className="d-flex">
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {!isLoading && <i className="bi bi-floppy"></i>}
            {isLoading && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
            &nbsp;Save API Key
          </button>
          <button type="button" className="btn btn-outline-danger ms-auto" onClick={handleReset}>
            <i className="bi bi-trash"></i>
            &nbsp;Reset
          </button>
        </div>
      </form>
    </>
  );
}

export default Config;
