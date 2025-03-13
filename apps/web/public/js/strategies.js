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
        canvas, clearCanvas, updateStatus, updateResultsStatus
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
        
        // Clear the canvas properly
        if (!canvas) {
          throw new Error("Canvas element not found");
        }
        
        // Always clear canvas before drawing to prevent overlap with other strategies
        clearCanvas();
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }
        
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
        if (!canvas || !ts2ResultContainer) {
          const errorMsg = 'Required DOM elements are missing for O1 strategy';
          console.error(errorMsg);
          updateStatus(errorMsg, statusContainer);
          return;
        }

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
          let lineEndpoints = [];
          let processedImage = null;

          // Set up the main canvas with correct dimensions
          clearCanvas();
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error("Could not get canvas context");
          }
          
          // 1. Skeletonize the image 
          if (doSkeletonize) {
            updateResultsStatus('Skeletonizing image with O(1) algorithm...', resultsStatusContainer);
            processedImage = await skeletonize2Image(img, {
              threshold: options.threshVal,
              inverse: true,
              cacheBuster: Date.now() 
            });
            
            // Ensure canvas matches the processed image dimensions
            canvas.width = processedImage.skeleton.width;
            canvas.height = processedImage.skeleton.height;
            
            // Render the skeletonized image to main canvas
            renderImageDataToCanvas2(processedImage.skeleton, canvas);
          } else {
            // If not skeletonizing, just draw the original image at its natural size
            ctx.drawImage(img, 0, 0, img.width, img.height);
            
            // Create a dummy processedImage object with correct dimensions
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
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
            updateResultsStatus(`Found ${corners.length} corners with O(1) algorithm.`, resultsStatusContainer);
          }
          
          // 3. Detect lines if option is checked
          if (doLines && processedImage) {
            updateResultsStatus('Detecting lines with O(1) algorithm...', resultsStatusContainer);
            
            // Set adaptive parameters based on image size
            const adaptiveDistance = Math.max(5, Math.min(10, Math.floor(canvas.width / 80)));
            const adaptiveMaxGap = Math.max(5, Math.min(15, Math.floor(canvas.width / 40)));
            
            // Detect lines with appropriate parameters
            lines = detectStraightLines2(processedImage.skeleton, {
              threshold: 20,
              minLineLength: 20,
              maxLineGap: adaptiveMaxGap,
              maxDistance: adaptiveDistance
            });
            
            updateResultsStatus(`Detected ${lines.length} lines with O(1) algorithm.`, resultsStatusContainer);
            
            // Find line intersections if we have lines
            if (lines.length > 1) {
              lineIntersections = findIntersections(lines);
              updateResultsStatus(`Found ${lineIntersections.length} line intersections.`, resultsStatusContainer);
            }
          }
          
          // 4. Cluster points if option is checked
          if (doCluster && (corners.length > 0 || lineIntersections.length > 0 || lineEndpoints.length > 0)) {
            updateResultsStatus('Clustering points with O(1) algorithm...', resultsStatusContainer);
            
            // Combine all detected points for clustering
            const allPoints = [
              ...corners,
              ...lineIntersections,
              ...lineEndpoints
            ];
            
            // Cluster with appropriate max distance based on image size
            const clusterDistance = Math.max(5, Math.min(20, Math.floor(canvas.width / 50)));
            clusteredPoints = clusterPoints2(allPoints, {
              maxDistance: clusterDistance,
              distanceThreshold: 30,
              preserveTypes: true
            });
            
            // Restore the clean skeleton for drawing
            processedImage.skeleton = cleanSkeleton;
            
            // Draw lines first if we have them
            if (lines.length > 0) {
              processedImage.skeleton = drawLines2(processedImage.skeleton, lines, true);
            }
            
            // Then draw clustered points on top
            if (clusteredPoints.length > 0) {
              processedImage.skeleton = drawClusteredPoints2(processedImage.skeleton, clusteredPoints, true);
            }
            
            // Render the final image to canvas
            renderImageDataToCanvas2(processedImage.skeleton, canvas);
            
            updateResultsStatus(`Clustered into ${clusteredPoints.length} points with O(1) algorithm.`, resultsStatusContainer);
          } else {
            // If not clustering, still draw lines if we have them
            if (lines.length > 0) {
              processedImage.skeleton = drawLines2(processedImage.skeleton, lines, true);
              renderImageDataToCanvas2(processedImage.skeleton, canvas);
            }
          }
          
          // Clear the result container
          if (ts2ResultContainer) {
            ts2ResultContainer.innerHTML = '';
            
            // Add the heading
            const heading = document.createElement('h3');
            heading.textContent = 'O(1) TypeScript Implementation Results:';
            ts2ResultContainer.appendChild(heading);
            
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
          }
          
          updateStatus('O(1) TypeScript processing complete!', statusContainer);
          updateResultsStatus('O(1) TypeScript processing complete!', resultsStatusContainer);
          
          // Use the safe switchTab function to switch to the O1 tab
          // Instead of manually manipulating DOM elements
          if (typeof switchTab === 'function') {
            switchTab({
              tabName: 'ts2',
              apiResultsTab, tsResultsTab, ts2ResultsTab, aiResultsTab,
              apiResultContainer, tsResultContainer, ts2ResultContainer, aiResultContainer,
              canvasContainer, annotatedURL: null, canvas, tsImageProcessed: true
            });
          } else {
            // Fallback to manual tab switching if switchTab is not available
            if (apiResultsTab) apiResultsTab.classList.remove('active');
            if (tsResultsTab) tsResultsTab.classList.remove('active'); 
            if (ts2ResultsTab) ts2ResultsTab.classList.add('active');
            if (aiResultsTab) aiResultsTab.classList.remove('active');
            
            if (apiResultContainer) apiResultContainer.style.display = 'none';
            if (tsResultContainer) tsResultContainer.style.display = 'none';
            if (ts2ResultContainer) ts2ResultContainer.style.display = 'block';
            if (aiResultContainer) aiResultContainer.style.display = 'none';
            if (canvasContainer) canvasContainer.style.display = 'block';
          }
          
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