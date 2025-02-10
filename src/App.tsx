import { useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Config from "./pages/Config";
import Gallery from "./pages/Gallery";

function App() {
  useEffect(() => {
    // Detect OS theme preference
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-bs-theme", isDarkMode ? "dark" : "light");
  }, []);

  return (
    <div className="container">
      <nav className="navbar navbar-expand bg-body-tertiary">
        <NavLink className="navbar-brand ps-2" to="/">
          <i className="bi bi-images"></i> FileLu Gallery
        </NavLink>
        <div className="navbar-nav">
          <NavLink className="nav-link" to="/" end>Home</NavLink>
          <NavLink className="nav-link" to="/config">Config</NavLink>
          <NavLink className="nav-link" to="/gallery">Gallery</NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/config" element={<Config />} />
        <Route path="/gallery/*" element={<Gallery />} />
      </Routes>
    </div>
  )
}

export default App
