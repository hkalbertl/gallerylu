import { useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Images, Gear, Github } from "react-bootstrap-icons";
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
    <div className="container-fluid container-md">
      <nav className="navbar navbar-expand bg-body-tertiary mb-3">
        <NavLink className="navbar-brand ps-2" to="/">
          GalleryLu
        </NavLink>
        <div className="navbar-nav">
          <NavLink className="nav-link" to="/gallery">
            <Images />
            &nbsp;Gallery
          </NavLink>
          <NavLink className="nav-link" to="/config">
            <Gear />
            &nbsp;Config
          </NavLink>
        </div>
        <div className="navbar-nav ms-auto">
          <a className="nav-link" href="https://github.com/hkalbertl/gallerylu" target="_blank">
            <Github />
          </a>
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
