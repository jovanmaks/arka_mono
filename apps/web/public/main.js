/**
 * Main entry point for the floorplan processing application
 */
import { 
  updateStatus, 
  updateResultsStatus, 
  clearCanvas, 
  createImageFromFile 
} from './js/utils.js';

import { 
  showAPIResults, 
  showTSResults, 
  handleSonnetCheckboxDependencies, 
  handleO1CheckboxDependencies,
  switchTab 
} from './js/ui.js';

import { 
  FloorplanProcessingStrategy, 
  createFloorplanStrategies, 
  executeFloorplanStrategy 
} from './js/strategies.js';

// Import our floorplan processor libraries
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
  skeletonizeImage as skeletonize2Image,
  renderImageDataToCanvas as renderImageDataToCanvas2,
  detectCorners as detectCorners2,
  clusterPoints as clusterPoints2,
  drawClusteredPoints as drawClusteredPoints2,
  detectStraightLines as detectStraightLines2,
  drawLines as drawLines2,
  drawCorners as drawCorners2,
  findIntersections,
  connectJunctionsToLines
} from "/floorplan-o1/mod.js";

// State management
let selectedFile = null;
let previewURL = null;
let annotatedURL = null;
let tsImageProcessed = false;
let floorplanStrategies = null;

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

// Get references to Sonnet checkbox elements
const skeletonizeCheck = document.getElementById('skeletonizeCheck');
const cornersCheck = document.getElementById('cornersCheck');
const clusterCheck = document.getElementById('clusterCheck');
const linesCheck = document.getElementById('linesCheck');

// Get references to O1 checkbox elements
const o1SkeletonizeCheck = document.getElementById('o1SkeletonizeCheck');
const o1CornersCheck = document.getElementById('o1CornersCheck');
const o1ClusterCheck = document.getElementById('o1ClusterCheck');
const o1LinesCheck = document.getElementById('o1LinesCheck');

// Initialize strategies
function initializeStrategies() {
  floorplanStrategies = createFloorplanStrategies({
    // Utils
    updateStatus: (message) => updateStatus(message, statusContainer), 
    updateResultsStatus: (message) => updateResultsStatus(message, resultsStatusContainer),
    clearCanvas: (ctx, canvas) => clearCanvas(ctx, canvas),
    
    // UI
    showAPIResults: (imageUrl, data) => showAPIResults(imageUrl, data, apiResultContainer),
    showTSResults: (corners, clusteredPoints, lines) => showTSResults(corners, clusteredPoints, lines, tsResultContainer),
    switchTab,
    
    // DOM elements
    skeletonizeCheck,
    cornersCheck,
    clusterCheck,
    linesCheck,
    o1SkeletonizeCheck,
    o1CornersCheck,
    o1ClusterCheck,
    o1LinesCheck,
    canvas,
    ctx,
    ts2ResultContainer,
    
    // Libraries
    renderImageDataToCanvas,
    drawClusteredPoints,
    renderImageDataToCanvas2,
    skeletonizeImage,
    detectCorners,
    clusterPoints,
    detectStraightWallsHough,
    drawLines,
    skeletonize2Image,
    detectCorners2,
    clusterPoints2,
    detectStraightLines2,
    drawLines2,
    drawCorners2,
    findIntersections,
    drawClusteredPoints2,
    connectJunctionsToLines
  });

  return floorplanStrategies;
}

/**
 * Handle file selection change
 */
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
      updateStatus('', statusContainer);
      updateResultsStatus('', resultsStatusContainer);
  }
}

/**
 * Handle scan button click
 */
async function handleScanClick(strategyType) {
  if (!selectedFile) {
      updateStatus('No file selected!', statusContainer);
      return;
  }

  try {
      // Get options from UI inputs
      const options = {
          threshVal: parseInt(thresholdInput.value, 10) || 100,
          clusters: parseInt(clustersInput.value, 10) || 20
      };

      // Ensure strategies are initialized
      if (!floorplanStrategies) {
          floorplanStrategies = initializeStrategies();
      }
      
      // Create context for strategy execution
      const context = {
          apiResultContainer,
          tsResultContainer,
          ts2ResultContainer,
          statusContainer,
          resultsStatusContainer,
          annotatedURL,
          updateStatus: (message) => updateStatus(message, statusContainer),
          updateResultsStatus: (message) => updateResultsStatus(message, resultsStatusContainer)
      };
      
      // Execute the selected strategy
      const result = await executeFloorplanStrategy(
          strategyType, 
          selectedFile, 
          options, 
          floorplanStrategies,
          context
      );
      
      // Update state based on result
      if (strategyType === FloorplanProcessingStrategy.PYTHON_API && result.annotatedURL) {
          annotatedURL = result.annotatedURL;
      } else if (strategyType === FloorplanProcessingStrategy.TS_PROCESSOR && result.tsImageProcessed) {
          tsImageProcessed = result.tsImageProcessed;
      }
      
  } catch (err) {
      console.error(err);
      updateStatus(`Error: ${err.message}`, statusContainer);
      updateResultsStatus(`Error: ${err.message}`, resultsStatusContainer);
  }
}

/**
 * Handle clear button click
 */
function handleClear() {
  selectedFile = null;
  previewURL = null;
  annotatedURL = null;
  tsImageProcessed = false;
  
  // Reset form
  fileInput.value = '';
  thresholdInput.value = '100';
  clustersInput.value = '20';
  document.getElementById('thresholdValue').textContent = '100';
  document.getElementById('clustersValue').textContent = '20';
  scanButton.disabled = true;
  scanTsButton.disabled = true;
  scanTs2Button.disabled = true;
  
  // Reset Sonnet checkboxes to default
  skeletonizeCheck.checked = true;
  cornersCheck.checked = false;
  clusterCheck.checked = false;
  linesCheck.checked = false;
  handleSonnetCheckboxDependencies(skeletonizeCheck, cornersCheck, clusterCheck, linesCheck);
  
  // Reset O1 checkboxes to default
  o1SkeletonizeCheck.checked = true;
  o1CornersCheck.checked = false;
  o1ClusterCheck.checked = false;
  o1LinesCheck.checked = false;
  handleO1CheckboxDependencies(o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck);
  
  // Clear displays
  previewContainer.innerHTML = '';
  apiResultContainer.innerHTML = '';
  tsResultContainer.innerHTML = '';
  ts2ResultContainer.innerHTML = '';
  updateStatus('', statusContainer);
  updateResultsStatus('', resultsStatusContainer);
  
  // Clear canvas
  clearCanvas(ctx, canvas);
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the strategies
  floorplanStrategies = initializeStrategies();

  // Event Handlers
  fileInput.addEventListener('change', handleFileChange);
  scanButton.addEventListener('click', () => handleScanClick(FloorplanProcessingStrategy.PYTHON_API));
  clearButton.addEventListener('click', handleClear);
  scanTsButton.addEventListener('click', () => handleScanClick(FloorplanProcessingStrategy.TS_PROCESSOR));
  scanTs2Button.addEventListener('click', () => handleScanClick(FloorplanProcessingStrategy.O1_PROCESSOR));
  
  // Add slider value update handlers
  thresholdInput.addEventListener('input', () => {
      document.getElementById('thresholdValue').textContent = thresholdInput.value;
  });
  clustersInput.addEventListener('input', () => {
      document.getElementById('clustersValue').textContent = clustersInput.value;
  });
  
  // Checkbox dependency handling for Sonnet
  cornersCheck.addEventListener('change', () => 
    handleSonnetCheckboxDependencies(skeletonizeCheck, cornersCheck, clusterCheck, linesCheck));
  clusterCheck.addEventListener('change', () => 
    handleSonnetCheckboxDependencies(skeletonizeCheck, cornersCheck, clusterCheck, linesCheck));
  linesCheck.addEventListener('change', () => 
    handleSonnetCheckboxDependencies(skeletonizeCheck, cornersCheck, clusterCheck, linesCheck));
  skeletonizeCheck.addEventListener('change', () => 
    handleSonnetCheckboxDependencies(skeletonizeCheck, cornersCheck, clusterCheck, linesCheck));
  
  // Checkbox dependency handling for O1
  o1CornersCheck.addEventListener('change', () => 
    handleO1CheckboxDependencies(o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck));
  o1ClusterCheck.addEventListener('change', () => 
    handleO1CheckboxDependencies(o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck));
  o1LinesCheck.addEventListener('change', () => 
    handleO1CheckboxDependencies(o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck));
  o1SkeletonizeCheck.addEventListener('change', () => 
    handleO1CheckboxDependencies(o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck));
  
  // Tab handlers
  apiResultsTab.addEventListener('click', () => 
    switchTab({
      tabName: 'api',
      apiResultsTab, tsResultsTab, ts2ResultsTab,
      apiResultContainer, tsResultContainer, ts2ResultContainer,
      canvasContainer, annotatedURL, canvas, tsImageProcessed,
      handleScanClick, FloorplanProcessingStrategy
    })
  );
  
  tsResultsTab.addEventListener('click', () => 
    switchTab({
      tabName: 'ts',
      apiResultsTab, tsResultsTab, ts2ResultsTab,
      apiResultContainer, tsResultContainer, ts2ResultContainer,
      canvasContainer, annotatedURL, canvas, tsImageProcessed,
      handleScanClick, FloorplanProcessingStrategy
    })
  );
  
  ts2ResultsTab.addEventListener('click', () => 
    switchTab({
      tabName: 'ts2',
      apiResultsTab, tsResultsTab, ts2ResultsTab,
      apiResultContainer, tsResultContainer, ts2ResultContainer,
      canvasContainer, annotatedURL, canvas, tsImageProcessed,
      handleScanClick, FloorplanProcessingStrategy
    })
  );
  
  // Initialize checkbox dependencies
  handleSonnetCheckboxDependencies(skeletonizeCheck, cornersCheck, clusterCheck, linesCheck);
  handleO1CheckboxDependencies(o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck);
});