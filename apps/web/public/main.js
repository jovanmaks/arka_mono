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

// Get references to checkbox elements
const skeletonizeCheck = document.getElementById('skeletonizeCheck');
const cornersCheck = document.getElementById('cornersCheck');
const clusterCheck = document.getElementById('clusterCheck');
const linesCheck = document.getElementById('linesCheck');

// Import our floorplan processor library
import { 
  skeletonizeImage,
  renderImageDataToCanvas,
  detectCorners,
  clusterPoints,
  drawClusteredPoints,
  detectStraightWallsHough,
  drawLines
} from "/floorplan-sonnet/mod.js";

// Import the O(1) floorplan processor module
import { 
  skeletonize2Image,
  renderImageDataToCanvas as renderImageDataToCanvas2
} from "/floorplan-o1/mod.js";

// Define Strategy Pattern for floorplan processing
const FloorplanProcessingStrategy = {
  // Python API Strategy
  PYTHON_API: 'python_api',
  // TypeScript Floorplan Processor Strategy
  TS_PROCESSOR: 'ts_processor',
  // O(1) Algorithm Strategy
  O1_PROCESSOR: 'o1_processor'
};

// Strategy implementation
const floorplanStrategies = {
  // Python API Strategy
  [FloorplanProcessingStrategy.PYTHON_API]: {
    name: 'Python API',
    process: async function(file, options) {
      updateStatus('Processing with Python API...');
      updateResultsStatus('Processing with Python API...');
      
      // Prepare form data
      const formData = new FormData();
      formData.append('image', file);
      formData.append('thresh_val', options.threshVal);
      formData.append('clusters', options.clusters);
      
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
      
      return data;
    }
  },
  
  // TypeScript Floorplan Processor Strategy
  [FloorplanProcessingStrategy.TS_PROCESSOR]: {
    name: 'TypeScript Processor',
    process: async function(file, options) {
      updateStatus('Processing using TypeScript implementation...');
      updateResultsStatus('Processing with TypeScript implementation...');
      
      // Get processing options from checkboxes
      const doSkeletonize = skeletonizeCheck.checked;
      const doCorners = cornersCheck.checked;
      const doCluster = clusterCheck.checked;
      const doLines = linesCheck.checked;
      
      // Process the image using our TS library with selected options
      const img = await createImageFromFile(file);
      
      // Initialize arrays to store results
      let corners = [];
      let clusteredPoints = [];
      let lines = [];
      let processedImage = null;
      
      // Clear the canvas
      clearCanvas();
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 1. Skeletonize the image (always needed as base)
      if (doSkeletonize) {
        updateResultsStatus('Skeletonizing image...');
        processedImage = await skeletonizeImage(img, options.threshVal);
        
        // Copy skeleton to the canvas
        renderImageDataToCanvas(processedImage.skeleton, canvas);
      } else {
        // If not skeletonizing, just draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Create a dummy processedImage object with original image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        processedImage = {
          skeleton: imageData,
          originalWidth: img.width,
          originalHeight: img.height,
          debugInfo: { thresholdValue: options.threshVal }
        };
      }
      
      // 2. Detect corners if option is checked
      if (doCorners && processedImage) {
        updateResultsStatus('Detecting corners...');
        corners = detectCorners(processedImage.skeleton);
        updateResultsStatus(`Found ${corners.length} corners.`);
      }
      
      // 3. Cluster points if option is checked
      if (doCluster && corners.length > 0) {
        updateResultsStatus('Clustering points...');
        clusteredPoints = clusterPoints(corners, options.clusters);
        
        // Draw the clustered points on the canvas
        drawClusteredPoints(processedImage.skeleton, clusteredPoints, true);
        renderImageDataToCanvas(processedImage.skeleton, canvas);
        updateResultsStatus(`Clustered into ${clusteredPoints.length} points.`);
      }
      
      // 4. Detect lines if option is checked
      if (doLines && processedImage) {
        updateResultsStatus('Detecting lines...');
        lines = detectStraightWallsHough(
          processedImage.skeleton, 
          30,  // threshold
          50,  // minLineLength
          10   // maxLineGap
        );
        
        // Draw the lines on the canvas
        drawLines(processedImage.skeleton, lines);
        renderImageDataToCanvas(processedImage.skeleton, canvas);
        updateResultsStatus(`Detected ${lines.length} lines.`);
      }
      
      tsImageProcessed = true;
      
      updateStatus('TypeScript processing complete!');
      updateResultsStatus('TypeScript processing complete!');
      
      // Show result details
      showTSResults(corners, clusteredPoints, lines);
      
      // Switch to TS results tab to show the canvas
      switchTab('ts');
      
      return {
        processedImage,
        corners,
        clusteredPoints,
        lines
      };
    }
  },
  
  // O(1) Algorithm Strategy
  [FloorplanProcessingStrategy.O1_PROCESSOR]: {
    name: 'O(1) Algorithm',
    process: async function(file, options) {
      updateStatus('Processing using O(1) TypeScript implementation...');
      updateResultsStatus('Processing using O(1) TypeScript implementation...');
      
      // Process the image using the O(1) algorithm
      try {
        const img = await createImageFromFile(file);
        
        // Use skeletonize2Image function
        const processedImage = await skeletonize2Image(img, options.threshVal);
        
        // Create a second canvas for the O(1) results
        const o1Canvas = document.createElement('canvas');
        o1Canvas.style.maxWidth = '100%';
        o1Canvas.style.height = 'auto';
        
        // Render the skeletonized image to canvas
        renderImageDataToCanvas2(processedImage.skeleton, o1Canvas);
        
        // Add the canvas to the result container
        ts2ResultContainer.innerHTML = '<h3>O(1) TypeScript Implementation Results:</h3>';
        ts2ResultContainer.appendChild(o1Canvas);
        
        // Add debug info
        const debugInfo = document.createElement('div');
        debugInfo.innerHTML = `<p>
          <strong>Debug Info:</strong>
          <ul>
            <li>Threshold Value: ${options.threshVal}</li>
            <li>Algorithm: ${processedImage.debugInfo.algorithm}</li>
            <li>Original Size: ${processedImage.originalWidth} × ${processedImage.originalHeight}</li>
          </ul>
        </p>`;
        ts2ResultContainer.appendChild(debugInfo);
        
        updateStatus('O(1) TypeScript processing complete!');
        updateResultsStatus('O(1) TypeScript processing complete!');
        
        // Switch to TS2 results tab
        switchTab('ts2');
        
        return {
          processedImage,
          corners: [],
          clusteredPoints: [],
          lines: []
        };
      } catch (err) {
        console.error('O(1) processing error:', err);
        updateStatus(`Error: ${err.message}`);
        updateResultsStatus(`Error: ${err.message}`);
        throw err;
      }
    }
  }
};

// Strategy execution function
async function executeFloorplanStrategy(strategyType, file, options) {
  try {
    const strategy = floorplanStrategies[strategyType];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyType}`);
    }
    
    return await strategy.process(file, options);
  } catch (err) {
    console.error(`Strategy execution error (${strategyType}):`, err);
    updateStatus(`Error: ${err.message}`);
    updateResultsStatus(`Error: ${err.message}`);
    throw err;
  }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Event Handlers
    fileInput.addEventListener('change', handleFileChange);
    scanButton.addEventListener('click', () => handleScanClick(FloorplanProcessingStrategy.PYTHON_API));
    clearButton.addEventListener('click', handleClear);
    scanTsButton.addEventListener('click', () => handleScanClick(FloorplanProcessingStrategy.TS_PROCESSOR));
    scanTs2Button.addEventListener('click', () => handleScanClick(FloorplanProcessingStrategy.O1_PROCESSOR));
    
    // Checkbox dependency handling
    cornersCheck.addEventListener('change', handleCheckboxDependencies);
    clusterCheck.addEventListener('change', handleCheckboxDependencies);
    linesCheck.addEventListener('change', handleCheckboxDependencies);
    skeletonizeCheck.addEventListener('change', handleCheckboxDependencies);
    
    // Tab handlers
    apiResultsTab.addEventListener('click', () => switchTab('api'));
    tsResultsTab.addEventListener('click', () => switchTab('ts'));
    ts2ResultsTab.addEventListener('click', () => switchTab('ts2'));
    
    // Initialize checkbox dependencies
    handleCheckboxDependencies();
});

// Handle checkbox dependencies
function handleCheckboxDependencies() {
  // If skeletonize is unchecked, disable all others
  if (!skeletonizeCheck.checked) {
    cornersCheck.disabled = true;
    clusterCheck.disabled = true;
    linesCheck.disabled = true;
  } else {
    cornersCheck.disabled = false;
    
    // If corner detection is unchecked, disable clustering
    if (!cornersCheck.checked) {
      clusterCheck.disabled = true;
      clusterCheck.checked = false;
    } else {
      clusterCheck.disabled = false;
    }
    
    // Lines can be detected with or without corners
    linesCheck.disabled = false;
  }
}

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

async function handleScanClick(strategyType) {
    if (!selectedFile) {
        updateStatus('No file selected!');
        return;
    }

    try {
        // Get options from UI inputs
        const options = {
            threshVal: parseInt(thresholdInput.value, 10) || 100,
            clusters: parseInt(clustersInput.value, 10) || 20
        };
        
        // Execute the selected strategy
        await executeFloorplanStrategy(strategyType, selectedFile, options);
    } catch (err) {
        console.error(err);
        updateStatus(`Error: ${err.message}`);
        updateResultsStatus(`Error: ${err.message}`);
    }
}

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
    
    // Reset checkboxes to default
    skeletonizeCheck.checked = true;
    cornersCheck.checked = false;
    clusterCheck.checked = false;
    linesCheck.checked = false;
    handleCheckboxDependencies();
    
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
            handleScanClick(FloorplanProcessingStrategy.TS_PROCESSOR);
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