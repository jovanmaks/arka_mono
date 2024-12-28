// File: apps/web/src/App.tsx
import React, { useState } from "react";
import Scene from "./Scene";

export default function App() {
  // 1. File Upload / Preview State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  // 2. Output: Annotated image
  const [annotatedURL, setAnnotatedURL] = useState<string | null>(null);

  // 3. Threshold and Clusters as user input
  const [threshold, setThreshold] = useState<string>("100");
  const [clusters, setClusters] = useState<string>("20");

  // 4. Status messages
  const [status, setStatus] = useState<string>("");

  /**
   * Handle file input change
   */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewURL(URL.createObjectURL(file));
      setAnnotatedURL(null);
      setStatus("");
    }
  }

  /**
   * Handle the "Scan" button click
   */
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
      formData.append("thresh_val", threshold);   // from user input
      formData.append("clusters", clusters);      // from user input

      // POST request to Flask
      const response = await fetch("http://localhost:5000/process-floorplan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // Attempt to read error message from JSON
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus("Processing complete!");

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

  /**
   * Handle the "Clear" button click
   * Resets everything so a new image can be uploaded fresh.
   */
  function handleClear() {
    setSelectedFile(null);
    setPreviewURL(null);
    setAnnotatedURL(null);
    setThreshold("100");   // optional: reset to default
    setClusters("20");     // optional: reset to default
    setStatus("");
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
      {/* LEFT COLUMN */}
      <div style={{ width: "50%", display: "flex", flexDirection: "column" }}>
        
        {/* 1. Upload & Preview */}
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

        {/* 2. Controls & Result */}
        <div style={{ flex: 1, border: "1px solid gray", padding: "1rem", overflowY: "auto" }}>
          <h2>Scan Settings</h2>
          {/* Threshold Input */}
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Threshold:{" "}
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              style={{ width: "80px" }}
            />
          </label>
          {/* Clusters Input */}
          <label style={{ display: "block", marginBottom: "1rem" }}>
            Clusters:{" "}
            <input
              type="number"
              value={clusters}
              onChange={(e) => setClusters(e.target.value)}
              style={{ width: "80px" }}
            />
          </label>

          {/* Buttons: Scan & Clear */}
          <button onClick={handleScanClick} disabled={!selectedFile} style={{ marginRight: "1rem" }}>
            Scan Floorplan
          </button>
          <button onClick={handleClear}>
            Clear
          </button>

          <div style={{ marginTop: "1rem" }}>
            <p>Status: {status}</p>
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

      {/* RIGHT COLUMN: 3D Scene */}
      <div style={{ width: "50%", border: "1px solid gray" }}>
        <Scene />
      </div>
    </div>
  );
}
