import { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";

// Handle the reverse proxy to FileLu direct link data
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fileUrl = req.query.url;

  if (!fileUrl || typeof fileUrl !== 'string' || 0 !== fileUrl.search(/^https\:\/\/([0-9]+\.)?filelu\..+/i)) {
    return res.status(400).json({ error: "Missing or invalid file URL" });
  }

  try {
    const response = await fetch(fileUrl);
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "https://gallerylu.vercel.app");
    response.body?.pipe(res);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
}
