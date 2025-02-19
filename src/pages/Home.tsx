function Home() {
  return (<>
    <h2>Welcome to GalleryLu</h2>
    <p className="lead">GalleryLu is a purely client-side React image explorer designed for browsing and previewing images stored on <a href="https://filelu.com/" target="_blank">FileLu</a>. It offers an intuitive interface for navigating folders and a lightbox preview for images. No data or API keys are transmitted to any server other than FileLu, ensuring user privacy and secure handling of credentials within the browser.</p>
    <p className="lead">As of v0.1.0, GalleryLu supports encrypted images uploaded from <a href="https://github.com/hkalbertl/web-image-categorizer" target="_blank">Web Image Categorizer (WIC)</a>. Vercel rewrite module is used to bypass CORS issue for encrypted images. Standard images are not affected and being downloaded from FileLu directly.</p>
    <p className="lead">To get started, please go to the <a href="/config">configuration page</a> and enter your FileLu API key.</p>
  </>);
}

export default Home;
