/**
 * Floorplan processing strategies
 */
import { createImageFromFile } from './utils.js';

// Define Strategy Pattern for floorplan processing
export const FloorplanProcessingStrategy = {
  // Python API Strategy
  PYTHON_API: 'python_api',
  // TypeScript Floorplan Processor Strategy
  TS_PROCESSOR: 'ts_processor',
  // O(1) Algorithm Strategy
  O1_PROCESSOR: 'o1_processor'
};

// Create and export the strategies
export function createFloorplanStrategies({ 
  updateStatus, updateResultsStatus, showAPIResults, showTSResults, switchTab, 
  skeletonizeCheck, cornersCheck, clusterCheck, linesCheck,
  o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck,
  canvas, ctx, renderImageDataToCanvas, drawClusteredPoints, renderImageDataToCanvas2,
  ts2ResultContainer, clearCanvas, skeletonizeImage, detectCorners, clusterPoints,
  detectStraightWallsHough, drawLines, skeletonize2Image, detectCorners2, 
  clusterPoints2, detectStraightLines2, drawLines2, drawCorners2, 
  findIntersections, drawClusteredPoints2, connectJunctionsToLines
}) {
  return {
    // Python API Strategy
    [FloorplanProcessingStrategy.PYTHON_API]: {
      name: 'Python API',
      process: async function(file, options, { 
        apiResultContainer, statusContainer, resultsStatusContainer,
        apiResultsTab, tsResultsTab, ts2ResultsTab, aiResultsTab,
        tsResultContainer, ts2ResultContainer, aiResultContainer, canvasContainer,
        canvas, updateStatus, updateResultsStatus
      }) {
        updateStatus('Processing with Python API...', statusContainer);
        updateResultsStatus('Processing with Python API...', resultsStatusContainer);
        
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
        
        updateStatus('Python API processing complete!', statusContainer);
        updateResultsStatus('Python API processing complete!', resultsStatusContainer);
        
        if (data.clusteredImagePath) {
            const newAnnotatedURL = `${baseUrl}/${data.clusteredImagePath}`;
            showAPIResults(newAnnotatedURL, data, apiResultContainer);
            
            // Force tab switch to API tab immediately
            // Make the API tab active
            apiResultsTab.classList.add('active');
            tsResultsTab.classList.remove('active');
            ts2ResultsTab.classList.remove('active');
            aiResultsTab.classList.remove('active');
            
            // Hide all result containers except API
            apiResultContainer.style.display = 'block';
            tsResultContainer.style.display = 'none';
            ts2ResultContainer.style.display = 'none';
            aiResultContainer.style.display = 'none';
            canvasContainer.style.display = 'none'; // Hide the shared canvas container
            
            return { ...data, annotatedURL: newAnnotatedURL };
        } else {
            updateResultsStatus('No annotated image path in the response.', resultsStatusContainer);
            return data;
        }
      }
    },
    
    // TypeScript Floorplan Processor Strategy
    [FloorplanProcessingStrategy.TS_PROCESSOR]: {
      name: 'TypeScript Processor',
      process: async function(file, options, {
        tsResultContainer, statusContainer, resultsStatusContainer,
        apiResultsTab, tsResultsTab, ts2ResultsTab,
        apiResultContainer, ts2ResultContainer, canvasContainer,
        canvas, updateStatus, updateResultsStatus
      }) {
        updateStatus('Processing using TypeScript implementation...', statusContainer);
        updateResultsStatus('Processing with TypeScript implementation...', resultsStatusContainer);
        
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
        clearCanvas(ctx, canvas);
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 1. Skeletonize the image (always needed as base)
        if (doSkeletonize) {
          updateResultsStatus('Skeletonizing image...', resultsStatusContainer);
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
          updateResultsStatus('Detecting corners...', resultsStatusContainer);
          corners = detectCorners(processedImage.skeleton);

          // Draw the corners on the canvas in yellow (similar to Python API)
          if (corners.length > 0) {
            ctx.fillStyle = '#ffff00'; // Yellow color
            corners.forEach(corner => {
              ctx.beginPath();
              ctx.arc(corner.x, corner.y, 3, 0, 2 * Math.PI);
              ctx.fill();
            });
          }

          updateResultsStatus(`Found ${corners.length} corners.`, resultsStatusContainer);
        }

        // 3. Cluster points if option is checked
        if (doCluster && corners.length > 0) {
          updateResultsStatus('Clustering points...', resultsStatusContainer);
          clusteredPoints = clusterPoints(corners, options.clusters);
          
          // Draw the clustered points on the canvas
          drawClusteredPoints(processedImage.skeleton, clusteredPoints, true);
          renderImageDataToCanvas(processedImage.skeleton, canvas);
          updateResultsStatus(`Clustered into ${clusteredPoints.length} points.`, resultsStatusContainer);
        }
        
        // 4. Detect lines if option is checked
        if (doLines && processedImage) {
          updateResultsStatus('Detecting lines...', resultsStatusContainer);
          
          // Calculate better threshold based on image size
          const adaptiveThreshold = Math.max(20, Math.min(30, Math.floor(canvas.width / 20)));
          const adaptiveMinLength = Math.max(30, Math.min(50, Math.floor(canvas.width / 10)));
          const adaptiveMaxGap = Math.max(5, Math.min(15, Math.floor(canvas.width / 40)));
          
          updateResultsStatus(`Using line parameters - threshold: ${adaptiveThreshold}, minLength: ${adaptiveMinLength}, maxGap: ${adaptiveMaxGap}`, resultsStatusContainer);
          
          if (clusteredPoints.length > 0) {
            // If we have clustered points, use our new algorithm that connects points directly
            updateResultsStatus('Using clustered points to generate lines...', resultsStatusContainer);
            
            // Call the improved wall detection with the clustered points
            lines = detectStraightWallsHough(
              processedImage.skeleton,
              adaptiveThreshold,
              adaptiveMinLength,
              adaptiveMaxGap,
              clusteredPoints  // Pass the clustered points to the algorithm
            );
            
            updateResultsStatus(`Created ${lines.length} lines from wall detection.`, resultsStatusContainer);
          } else if (corners.length > 0) {
            // If we have corners but no clusters, use corners directly
            updateResultsStatus('Using detected corners to generate lines...', resultsStatusContainer);
            
            // Call the improved wall detection with corner points
            lines = detectStraightWallsHough(
              processedImage.skeleton,
              adaptiveThreshold,
              adaptiveMinLength,
              adaptiveMaxGap,
              corners  // Pass corner points to the algorithm
            );
            
            updateResultsStatus(`Created ${lines.length} lines using corner points.`, resultsStatusContainer);
          } else {
            // Fallback to basic Hough transform without extra points
            lines = detectStraightWallsHough(
              processedImage.skeleton, 
              adaptiveThreshold,
              adaptiveMinLength,
              adaptiveMaxGap
            );
            updateResultsStatus(`Detected ${lines.length} lines with Hough transform.`, resultsStatusContainer);
          }
          
          // Draw the lines with increased width for better visibility
          if (lines.length > 0) {
            // Draw lines with a green color
            drawLines(processedImage.skeleton, lines);
            renderImageDataToCanvas(processedImage.skeleton, canvas);
          }
        }
        
        const tsImageProcessed = true;
        
        updateStatus('TypeScript processing complete!', statusContainer);
        updateResultsStatus('TypeScript processing complete!', resultsStatusContainer);
        
        // Show result details with additional point type counts
        const pointTypes = clusteredPoints.reduce((counts, point) => {
          counts[point.type || 'unclassified'] = (counts[point.type || 'unclassified'] || 0) + 1;
          return counts;
        }, {});

        // Add the canvas to the result container
        tsResultContainer.innerHTML = `
          <div>
            <h3>TypeScript Implementation Results:</h3>
            <p>
              <strong>Detected Features:</strong>
              <ul>
                <li>Total Points: ${clusteredPoints.length}</li>
                <li>Total Lines: ${lines.length}</li>
              </ul>
              
              <strong>Junction Types:</strong>
              <ul>
                <li>L-Junctions (Corners): ${pointTypes['corner'] || 0}</li>
                <li>T-Junctions: ${pointTypes['t_junction'] || 0}</li>
                <li>X-Junctions (Intersections): ${pointTypes['intersection'] || 0}</li>
                <li>Endpoints: ${pointTypes['endpoint'] || 0}</li>
                <li>Unclassified: ${pointTypes['unclassified'] || 0}</li>
              </ul>
              
              <strong>Debug Info:</strong>
              <ul>
                <li>Threshold Value: ${options.threshVal}</li>
                <li>Original Size: ${processedImage.originalWidth} × ${processedImage.originalHeight}</li>
                <li>Algorithm: ${processedImage.debugInfo?.algorithm || 'Sonnet Skeletonization'}</li>
              </ul>
            </p>
          </div>
        `;
        
        // Show result details
        showTSResults(corners, clusteredPoints, lines, tsResultContainer);
        
        // Switch to TS results tab to show the canvas
        switchTab({
          tabName: 'ts',
          apiResultsTab,
          tsResultsTab,
          ts2ResultsTab,
          aiResultsTab,
          apiResultContainer,
          tsResultContainer,
          ts2ResultContainer,
          aiResultContainer,
          canvasContainer,
          annotatedURL: null,
          canvas,
          tsImageProcessed
        });
        
        return {
          processedImage,
          corners,
          clusteredPoints,
          lines,
          tsImageProcessed
        };
      }
    },
    
    // O(1) Algorithm Strategy
    [FloorplanProcessingStrategy.O1_PROCESSOR]: {
      name: 'O(1) Algorithm',
      process: async function(file, options, {
        ts2ResultContainer, statusContainer, resultsStatusContainer,
        apiResultsTab, tsResultsTab, ts2ResultsTab, aiResultsTab,
        apiResultContainer, tsResultContainer, aiResultContainer, canvasContainer,
        canvas, updateStatus, updateResultsStatus
      }) {
        updateStatus('Processing using O(1) TypeScript implementation...', statusContainer);
        updateResultsStatus('Processing using O(1) TypeScript implementation...', resultsStatusContainer);
        
        // Get processing options from O1 checkboxes
        const doSkeletonize = o1SkeletonizeCheck.checked;
        const doCorners = o1CornersCheck.checked;
        const doCluster = o1ClusterCheck.checked;
        const doLines = o1LinesCheck.checked;
        
        try {
          const img = await createImageFromFile(file);
          
          // Initialize arrays to store results
          let corners = [];
          let clusteredPoints = [];
          let lines = [];
          let lineIntersections = [];
          let lineEndpoints = []; // Added to store line endpoints
          let processedImage = null;
          
          // Create a canvas for the O(1) results
          const o1Canvas = document.createElement('canvas');
          o1Canvas.style.maxWidth = '100%';
          o1Canvas.style.height = 'auto';
          o1Canvas.width = img.width;
          o1Canvas.height = img.height;
          
          // 1. Skeletonize the image 
          if (doSkeletonize) {
            updateResultsStatus('Skeletonizing image with O(1) algorithm...', resultsStatusContainer);
            // Explicitly pass the threshold value as an object
            processedImage = await skeletonize2Image(img, {
              threshold: options.threshVal,
              inverse: true,
              // Add a cache buster to ensure reprocessing when threshold changes
              cacheBuster: Date.now() 
            });
            
            // Render the skeletonized image to canvas
            renderImageDataToCanvas2(processedImage.skeleton, o1Canvas);
            
            // Log that we're using the user-specified threshold
            console.log(`Using threshold value: ${options.threshVal} for skeletonization`);
          } else {
            // If not skeletonizing, just draw the original image
            const o1Ctx = o1Canvas.getContext('2d');
            o1Ctx.drawImage(img, 0, 0);
            
            // Create a dummy processedImage object
            const imageData = o1Ctx.getImageData(0, 0, o1Canvas.width, o1Canvas.height);
            processedImage = {
              skeleton: imageData,
              originalWidth: img.width,
              originalHeight: img.height,
              debugInfo: { 
                thresholdValue: options.threshVal,
                algorithm: "Original image (no processing)"
              }
            };
          }
          
          // Store a clean copy of the skeletonized image for later
          const cleanSkeleton = new ImageData(
            new Uint8ClampedArray(processedImage.skeleton.data),
            processedImage.skeleton.width,
            processedImage.skeleton.height
          );
          
          // 2. Detect corners if option is checked
          if (doCorners && processedImage) {
            updateResultsStatus('Detecting corners with O(1) algorithm...', resultsStatusContainer);
            
            // Use more sensitive parameters for corner detection
            const cornerOptions = {
              minNeighbors: 2,     // Lower threshold from default 3
              minTransitions: 1,   // Lower threshold from default 2
            };
            
            corners = detectCorners2(processedImage.skeleton, cornerOptions);
            
            // DO NOT draw corners here - we'll only draw clustered points later
            updateResultsStatus(`Found ${corners.length} corners with O(1) algorithm.`, resultsStatusContainer);
          }
          
          // ... existing code for line detection ...
          
          // 4. Cluster points if option is checked
          if (doCluster && (corners.length > 0 || lineIntersections.length > 0 || lineEndpoints.length > 0)) {
            updateResultsStatus('Clustering points with O(1) algorithm...', resultsStatusContainer);
            
            // ... existing code for clustering ...
            
            // IMPORTANT: Start with clean skeleton image before drawing
            processedImage.skeleton = cleanSkeleton;
            
            // First draw lines if we have them
            if (lines.length > 0) {
              processedImage.skeleton = drawLines2(processedImage.skeleton, lines, true);
            }
            
            // Then draw clustered points on top
            if (clusteredPoints.length > 0) {
              processedImage.skeleton = drawClusteredPoints2(processedImage.skeleton, clusteredPoints, true);
            }
            
            // Render the final image with lines and clustered points to canvas
            renderImageDataToCanvas2(processedImage.skeleton, o1Canvas);
            
            updateResultsStatus(`Clustered into ${clusteredPoints.length} points with O(1) algorithm.`, resultsStatusContainer);
          } else {
            // If not clustering, still draw lines if we have them
            if (lines.length > 0) {
              processedImage.skeleton = drawLines2(processedImage.skeleton, lines, true);
              renderImageDataToCanvas2(processedImage.skeleton, o1Canvas);
            }
          }
          
          // Clear the main canvas to avoid showing Sonnet results alongside O1 results
          if (canvas && canvas.getContext) {
            const mainCtx = canvas.getContext('2d');
            if (mainCtx) {
              mainCtx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
          
          // Clear the result container first
          ts2ResultContainer.innerHTML = '';
          
          // Add the heading
          const heading = document.createElement('h3');
          heading.textContent = 'O(1) TypeScript Implementation Results:';
          ts2ResultContainer.appendChild(heading);
          
          // Add our canvas with results
          ts2ResultContainer.appendChild(o1Canvas);
          
          // Add debug and results info with point type counts
          const pointTypes = clusteredPoints.reduce((counts, point) => {
            counts[point.type || 'unclassified'] = (counts[point.type || 'unclassified'] || 0) + 1;
            return counts;
          }, {});
          
          const resultsInfo = document.createElement('div');
          resultsInfo.innerHTML = `<p>
            <strong>Detected Features:</strong>
            <ul>
              <li>Total Points: ${clusteredPoints.length}</li>
              <li>Total Lines: ${lines.length}</li>
              <li>Line Intersections: ${lineIntersections.length}</li>
            </ul>
            
            <strong>Junction Types:</strong>
            <ul>
              <li>L-Junctions (Corners): ${pointTypes['corner'] || 0}</li>
              <li>T-Junctions: ${pointTypes['t_junction'] || 0}</li>
              <li>X-Junctions (Intersections): ${pointTypes['intersection'] || 0}</li>
              <li>Endpoints: ${pointTypes['endpoint'] || 0}</li>
              <li>Unclassified: ${pointTypes['unclassified'] || 0}</li>
            </ul>
            
            <strong>Debug Info:</strong>
            <ul>
              <li>Threshold Value: ${options.threshVal}</li>
              <li>Algorithm: ${processedImage.debugInfo.algorithm || 'O(1) Skeletonization'}</li>
              <li>Original Size: ${processedImage.originalWidth} × ${processedImage.originalHeight}</li>
              <li>Line Detection: ${lines.length >= 3 ? 'Junction-based' : 'Hough transform'}</li>
            </ul>
          </p>`;
          
          ts2ResultContainer.appendChild(resultsInfo);
          
          updateStatus('O(1) TypeScript processing complete!', statusContainer);
          updateResultsStatus('O(1) TypeScript processing complete!', resultsStatusContainer);
          
          // Force tab switch to ts2 tab immediately
          // Make the ts2 tab active
          apiResultsTab.classList.remove('active');
          tsResultsTab.classList.remove('active');
          ts2ResultsTab.classList.add('active');
          aiResultsTab.classList.remove('active');
          
          // Hide all result containers except ts2
          apiResultContainer.style.display = 'none';
          tsResultContainer.style.display = 'none';
          ts2ResultContainer.style.display = 'block';
          aiResultContainer.style.display = 'none';
          canvasContainer.style.display = 'none'; // Hide the shared canvas container
          
          return {
            processedImage,
            corners,
            lines,
            lineIntersections,
            lineEndpoints,
            clusteredPoints
          };
        } catch (err) {
          console.error('O(1) processing error:', err);
          updateStatus(`Error: ${err.message}`, statusContainer);
          updateResultsStatus(`Error: ${err.message}`, resultsStatusContainer);
          throw err;
        }
      }
    }
  };
}

// Strategy execution function
export async function executeFloorplanStrategy(strategyType, file, options, strategies, context) {
  try {
    const strategy = strategies[strategyType];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyType}`);
    }
    
    return await strategy.process(file, options, context);
  } catch (err) {
    console.error(`Strategy execution error (${strategyType}):`, err);
    context.updateStatus(`Error: ${err.message}`, context.statusContainer);
    context.updateResultsStatus(`Error: ${err.message}`, context.resultsStatusContainer);
    throw err;
  }
}