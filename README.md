# GalleryLu

A React-based image gallery for previewing images uploaded to [FileLu](https://filelu.com/) cloud storage.

## Motivation
<details>
  <summary>Click to expand</summary>

  GalleryLu is my second open-source contribution to the FileLu ecosystem, following the <a href="https://github.com/hkalbertl/web-image-categorizer" target="_blank">Web Image Categorizer (WIC)</a>. While using FileLu to manage images uploaded by WIC, I identified some usability challenges. The folder navigation could be more efficient, and the image preview lacked the convenience of "next" and "previous" buttons. GalleryLu addresses these issues, providing a streamlined image browsing experience.

  Starting from version 0.1.0, a file encryption feature has been added. Since FileLu does not provide settings to modify the CORS response header, I had no choice but to use Vercel's rewrite module, which acts as a reverse proxy, to bypass the CORS issue. The Vercel rewrite module is only used for encrypted images; standard images are not affected and are served directly from FileLu. As the images passing through Vercel are encrypted, I believe the current implementation remains secure.

  Critically, user privacy is a core principle. All data processing occurs within the client's browser, and the application, hosted on Vercel, is purely static. Data transmission is strictly limited to communication with the FileLu API.

  If you are new to FileLu, please consider to register by using my <a href="https://filelu.com/5155514948.html" target="_blank">referral link</a>.
</details>

## Features
* Intuitive File Explorer Interface
  * Familiar folder/file structure navigation.
  * Clear visual hierarchy for folders and files.
  * Easy navigation using breadcrumbs.
  * Responsive design for various screen sizes (desktop, tablet, mobile).
* Image Preview
  * Click on image thumbnails to open a full-size preview.
  * Lightbox-style image viewer.
  * Image metadata display in lightbox view.
  * Sort images by file name or uploaded time.
* FileLu Integration
  * Seamless connection to FileLu's API using user-provided API key.
  * Secure handling of API key (client-side only, no server involved).
  * Data transfer directly between the user's browser and FileLu's servers.
* Encryption
  * Support viewing encrypted images uploaded by [Web Image Categorizer](https://github.com/hkalbertl/web-image-categorizer).
  * Decryption is performed on client side. Password and decrypted data never transmitted outside the application.
* User Privacy
  * Data privacy is a top priority.
  * No API keys are transmitted to any third-party server other than FileLu.
  * Standard images will be downloaded from FileLu directly.
  * Encrypted images will be downloaded through the [Vercel rewrite](https://vercel.com/docs/edge-network/rewrites) module due to [CORS issue](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors) and decrypted on user's browser.
  * All processing happens client-side in the user's web browser.

## Demo
https://github.com/user-attachments/assets/6e20a637-1740-47ae-b6fd-faa1d3d2f68b

## Terms of Use
Welcome to GalleryLu. By using this application, you agree to the following terms:

* Usage:
  * GalleryLu is provided for users to view images uploaded to FileLu.
* No Warranty:
  * GalleryLu is provided "as is" without any warranties, express or implied.
  * The author makes no representations or warranties in relation to the application or the information and materials provided.
* Limitation of Liability:
  * The author will not be liable for any damages arising from the use or inability to use GalleryLu.
  * This includes, without limitation, direct, indirect, incidental, or consequential damages.
* Privacy:
  * Users' data, such as files and API keys, will only be used to communicate with FileLu's API server.
  * No data will be stored or shared beyond the intended purpose.
* Modifications:
  *  The author reserves the right to modify these terms at any time.
  * Any changes will be posted on this page, and continued use of the application constitutes acceptance of the updated terms.

## Limitations
* GalleryLu supports common image formats only, such as `.jpg`, `.png`, `.bmp`, `.gif`, and `.webp`. Other files will be hidden.
* GalleryLu depends on FileLu's API. GalleryLu will not work when the API service is unavailable.
* FileLu does not provide an [API](https://filelu.com/pages/api/) that can list a folder's content with their direct download links. Therefore, GalleryLu has to request a download link for each image one by one. To prevent hitting the rate limit, GalleryLu may take time to load a large folder.
* FileLu does not provide settings for [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors). The encrypted images cannot be downloaded from FileLu server directly. [Vercel rewrite](https://vercel.com/docs/edge-network/rewrites) module is being used to bypass CORS issue.

## License
Licensed under the [MIT](http://www.opensource.org/licenses/mit-license.php) license.
