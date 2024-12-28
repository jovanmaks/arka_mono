// File: apps/web/src/App.tsx
import React, { useState } from "react";
import Scene from "./Scene";

export default function App() {
  // State for selected file and its preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  // State for the annotated image
  const [annotatedURL, setAnnotatedURL] = useState<string | null>(null);

  // Status messages
  const [status, setStatus] = useState<string>("");

  // Handle file input changes
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewURL(URL.createObjectURL(file));
      setAnnotatedURL(null);  // Reset annotated image
      setStatus("");
    }
  }

  // Handle the scan button click
  async function handleScanClick() {
    if (!selectedFile) {
      setStatus("No file selected!");
      return;
    }

    try {
      setStatus("Processing...");

      // Prepare form data
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("thresh_val", "100");  // Example threshold value
      formData.append("clusters", "20");     // Example number of clusters

      // Make POST request to Flask API
      const response = await fetch("http://localhost:5000/process-floorplan", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus("Processing complete!");

      // Extract the annotated image path
      if (data.clusteredImagePath) {
        const imageUrl = `http://localhost:5000/${data.clusteredImagePath}`;
        setAnnotatedURL(imageUrl);
      } else {
        setStatus("No annotated image path in the response.");
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
      {/* Left Column: Upload & Results */}
      <div style={{ width: "50%", display: "flex", flexDirection: "column" }}>
        {/* File Upload & Preview */}
        <div style={{ flex: 1, border: "1px solid gray", padding: "1rem", overflowY: "auto" }}>
          <h2>Floorplan Uploader</h2>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          {previewURL && (
            <div style={{ marginTop: "1rem" }}>
              <p>Uploaded Image Preview:</p>
              <img
                src={previewURL}
                alt="Preview"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>
          )}
        </div>

        {/* Scan Button & Annotated Image */}
        <div style={{ flex: 1, border: "1px solid gray", padding: "1rem", overflowY: "auto" }}>
          <h2>Scan Result</h2>
          <button onClick={handleScanClick} disabled={!selectedFile}>
            Scan Floorplan
          </button>
          <div style={{ marginTop: "1rem" }}>
            <p>Status: {status}</p>

            {/* Display Annotated Image */}
            {annotatedURL && (
              <div>
                <p>Annotated Skeleton:</p>
                <img
                  src={annotatedURL}
                  alt="Annotated Skeleton"
                  style={{ maxWidth: "100%", height: "auto", border: "1px solid #ccc" }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Spinning 3D Cube */}
      <div style={{ width: "50%", border: "1px solid gray" }}>
        <Scene />
      </div>
    </div>
  );
}
