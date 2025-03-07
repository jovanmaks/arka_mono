// State management
let selectedFile = null;
let previewURL = null;
let annotatedURL = null;
let tsImageProcessed = false;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const thresholdInput = document.getElementById('thresholdInput');
const clustersInput = document.getElementById('clustersInput');
const modelSelect = document.getElementById('modelSelect'); // Keep the reference for future TS implementation
const scanButton = document.getElementById('scanButton');
const clearButton = document.getElementById('clearButton');
const statusContainer = document.getElementById('statusContainer');
const apiResultContainer = document.getElementById('apiResultContainer');
const tsResultContainer = document.getElementById('tsResultContainer');
const canvas = document.getElementById('floorplanCanvas');
const canvasContainer = document.getElementById('canvasContainer');
const ctx = canvas.getContext('2d');
const scanTsButton = document.getElementById('scanTsButton');
const apiResultsTab = document.getElementById('apiResultsTab');
const tsResultsTab = document.getElementById('tsResultsTab');
const resultsStatusContainer = document.getElementById('resultsStatusContainer');

// Get references to the new elements
const ts2ResultsTab = document.getElementById('ts2ResultsTab');
const ts2ResultContainer = document.getElementById('ts2ResultContainer');
const scanTs2Button = document.getElementById('scanTs2Button');

// Import our floorplan processor library
import { 
  skeletonizeImage,
  renderImageDataToCanvas,
  detectCorners,
  clusterPoints,
  drawClusteredPoints,
  detectStraightWallsHough,
  drawLines
} from "/floorplan-processor/mod.js";

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Event Handlers
    fileInput.addEventListener('change', handleFileChange);
    scanButton.addEventListener('click', handleScanClick);
    clearButton.addEventListener('click', handleClear);
    scanTsButton.addEventListener('click', handleScanTsClick);
    
    // Tab handlers
    apiResultsTab.addEventListener('click', () => switchTab('api'));
    tsResultsTab.addEventListener('click', () => switchTab('ts'));
});

// Add the new tab to tab handling
[apiResultsTab, tsResultsTab, ts2ResultsTab].forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all tabs
    [apiResultsTab, tsResultsTab, ts2ResultsTab].forEach(t => t.classList.remove('active'));
    // Hide all result containers
    [apiResultContainer, tsResultContainer, ts2ResultContainer].forEach(c => c.style.display = 'none');
    
    // Show the selected tab and container
    tab.classList.add('active');
    if (tab === apiResultsTab) {
      apiResultContainer.style.display = 'block';
    } else if (tab === tsResultsTab) {
      tsResultContainer.style.display = 'block';
    } else if (tab === ts2ResultsTab) {
      ts2ResultContainer.style.display = 'block';
    }
  });
});

function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
        selectedFile = file;
        previewURL = URL.createObjectURL(file);
        
        // Enable both scan buttons
        scanButton.disabled = false;
        scanTsButton.disabled = false;
        scanTs2Button.disabled = false;

        // Create and show preview image
        const previewImg = new Image();
        previewImg.src = previewURL;
        previewImg.style.maxWidth = '100%';
        previewImg.style.height = 'auto';
        previewImg.alt = 'Preview';

        previewContainer.innerHTML = '<p>Uploaded Image Preview:</p>';
        previewContainer.appendChild(previewImg);

        // Reset state
        tsImageProcessed = false;
        
        // Clear previous results but keep any existing results
        updateStatus('');
        updateResultsStatus('');
    }
}

async function handleScanClick() {
    if (!selectedFile) {
        updateStatus('No file selected!');
        return;
    }

    try {
        updateStatus('Processing with Python API...');
        updateResultsStatus('Processing with Python API...');

        // Prepare form data
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('thresh_val', thresholdInput.value);
        formData.append('clusters', clustersInput.value);

        // Use consistent hostname for both API and images
        const baseUrl = `http://${window.location.hostname}:5000`;
        const response = await fetch(`${baseUrl}/process-floorplan`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.statusText}`);
        }

        const data = await response.json();
        updateStatus('Python API processing complete!');
        updateResultsStatus('Python API processing complete!');

        if (data.clusteredImagePath) {
            annotatedURL = `${baseUrl}/${data.clusteredImagePath}`;
            showAPIResults(annotatedURL, data);
            
            // Switch to API results tab
            switchTab('api');
        } else {
            updateResultsStatus('No annotated image path in the response.');
        }
    } catch (err) {
        console.error(err);
        updateStatus(`Error: ${err.message}`);
        updateResultsStatus(`Error: ${err.message}`);
    }
}

async function handleScanTsClick() {
    if (!selectedFile) {
        updateStatus('No file selected!');
        return;
    }

    try {
        updateStatus('Processing using TypeScript implementation...');
        updateResultsStatus('Processing using TypeScript implementation - Skeletonizing only...');
        
        // Get threshold value from input
        const threshVal = parseInt(thresholdInput.value, 10) || 100;
        
        // Process the image using our TS library - ONLY SKELETONIZE
        const img = await createImageFromFile(selectedFile);
        
        // 1. Skeletonize the image
        updateResultsStatus('Skeletonizing image...');
        const processedImage = await skeletonizeImage(img, threshVal);
        
        // Render only the skeletonized image to canvas
        renderImageDataToCanvas(processedImage.skeleton, canvas);
        tsImageProcessed = true;
        
        updateStatus('TypeScript processing complete - Skeletonize Only!');
        updateResultsStatus('TypeScript processing complete - Showing only the skeletonized image');
        
        // Show minimal result details
        showTSResults([/* no corners */], [/* no clustered points */], [/* no lines */]);
        
        // Switch to TS results tab to show the canvas
        switchTab('ts');
        
    } catch (err) {
        console.error(err);
        updateStatus(`Error: ${err.message}`);
        updateResultsStatus(`Error: ${err.message}`);
    }
}

scanTs2Button.addEventListener('click', async () => {
  if (!selectedFile) return;
  
  clearResults();
  updateStatus('Processing with TypeScript O(1) strategy...');
  ts2ResultsTab.click(); // Switch to the O(1) results tab
  
  // Placeholder for future implementation
  updateStatus('TypeScript O(1) strategy not implemented yet');
});

function handleClear() {
    selectedFile = null;
    previewURL = null;
    annotatedURL = null;
    tsImageProcessed = false;
    
    // Reset form
    fileInput.value = '';
    thresholdInput.value = '100';
    clustersInput.value = '20';
    scanButton.disabled = true;
    scanTsButton.disabled = true;
    scanTs2Button.disabled = true;
    
    // Clear displays
    previewContainer.innerHTML = '';
    apiResultContainer.innerHTML = '';
    tsResultContainer.innerHTML = '';
    ts2ResultContainer.innerHTML = '';
    updateStatus('');
    updateResultsStatus('');
    
    // Clear canvas
    clearCanvas();
}

function updateStatus(message) {
    statusContainer.innerHTML = `<p>Status: ${message}</p>`;
}

function updateResultsStatus(message) {
    if (resultsStatusContainer) {
        resultsStatusContainer.innerHTML = `<p>${message}</p>`;
    }
}

function showAPIResults(imageUrl, data) {
    apiResultContainer.innerHTML = `
        <div>
            <h3>Python API Results:</h3>
            <p>
                <ul>
                    <li>Detected ${data.corners?.length || 0} corners</li>
                    <li>Clustered into ${data.clusteredPoints?.length || 0} points</li>
                    <li>Found ${data.lines?.length || 0} lines</li>
                </ul>
            </p>
            <img src="${imageUrl}" alt="Python Processed Floorplan" 
                 style="max-width: 100%; height: auto; border: 1px solid #ccc" />
        </div>
    `;
}

function showTSResults(corners, clusteredPoints, lines) {
    tsResultContainer.innerHTML = `
        <div>
            <h3>TypeScript Implementation Results:</h3>
            <p>
                <ul>
                    <li>Detected ${corners.length} corners</li>
                    <li>Clustered into ${clusteredPoints.length} points</li>
                    <li>Found ${lines.length} lines</li>
                </ul>
            </p>
        </div>
    `;
}

function switchTab(tabName) {
    if (tabName === 'api') {
        // Show API results
        apiResultsTab.classList.add('active');
        tsResultsTab.classList.remove('active');
        ts2ResultsTab.classList.remove('active');
        
        // Show API content
        apiResultContainer.style.display = 'block';
        tsResultContainer.style.display = 'none';
        ts2ResultContainer.style.display = 'none';
        
        // Hide the canvas for API results, show the image instead
        if (canvasContainer) {
            canvasContainer.style.display = 'none';
        }
        
        // If we have an API result image, we don't need the canvas
        if (annotatedURL) {
            clearCanvas();
        }
    } else if (tabName === 'ts') {
        // Show TS results
        apiResultsTab.classList.remove('active');
        tsResultsTab.classList.add('active');
        ts2ResultsTab.classList.remove('active');
        
        // Show TS content
        apiResultContainer.style.display = 'none';
        tsResultContainer.style.display = 'block';
        ts2ResultContainer.style.display = 'none';
        
        // Show the canvas for TS results
        if (canvasContainer) {
            canvasContainer.style.display = 'flex';
        }
        
        // If we have processed the image with TS and have lost the canvas, recreate it
        if (tsImageProcessed && canvas.width === 0) {
            // Re-process the image - this is a simplified version that would need to be expanded
            handleScanTsClick();
        }
    } else if (tabName === 'ts2') {
        // Show TS O(1) results
        apiResultsTab.classList.remove('active');
        tsResultsTab.classList.remove('active');
        ts2ResultsTab.classList.add('active');
        
        // Show TS O(1) content
        apiResultContainer.style.display = 'none';
        tsResultContainer.style.display = 'none';
        ts2ResultContainer.style.display = 'block';
        
        // Hide the canvas for TS O(1) results
        if (canvasContainer) {
            canvasContainer.style.display = 'none';
        }
    }
}

function clearCanvas() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
    }
}

// Helper function to create an HTMLImageElement from a File
function createImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

// Helper function to convert a grayscale ImageData to RGB
function convertToRGB(imageData) {
    const { width, height, data } = imageData;
    const rgbData = new ImageData(width, height);
    
    for (let i = 0; i < data.length; i += 4) {
        rgbData.data[i] = data[i];       // R
        rgbData.data[i + 1] = data[i];   // G
        rgbData.data[i + 2] = data[i];   // B
        rgbData.data[i + 3] = data[i+3]; // A
    }
    
    return rgbData;
}