import { useState, useEffect } from "react";
import FileLu from "../utils/FileLu";

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
      const apiError = await FileLu.validateApiKey(apiKey);
      if (apiError) {
        setError(apiError);
        return;
      }

      // Save API Key to localStorage
      localStorage.setItem("apiKey", apiKey);

      setError(""); // Clear error if successful
      alert("API Key saved successfully!");
    } catch {
      console.error('Error occurred?');
    } finally {
      setIsLoading(false);
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
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {!isLoading && <i className="bi bi-floppy"></i>}
          {isLoading && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
          &nbsp;Save API Key
        </button>
      </form>
    </>
  );
}

export default Config;
