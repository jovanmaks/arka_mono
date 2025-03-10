/**
 * UI-related functions for floorplan processing application
 */
import { updateStatus, updateResultsStatus, clearCanvas } from './utils.js';

// Show API processing results
export function showAPIResults(imageUrl, data, apiResultContainer) {
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

// Show TypeScript processing results
export function showTSResults(corners, clusteredPoints, lines, tsResultContainer) {
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

// Handle Sonnet checkbox dependencies
export function handleSonnetCheckboxDependencies(skeletonizeCheck, cornersCheck, clusterCheck, linesCheck) {
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

// Handle O1 checkbox dependencies
export function handleO1CheckboxDependencies(o1SkeletonizeCheck, o1CornersCheck, o1ClusterCheck, o1LinesCheck) {
    // If skeletonize is unchecked, disable all others
    if (!o1SkeletonizeCheck.checked) {
        o1CornersCheck.disabled = true;
        o1ClusterCheck.disabled = true;
        o1LinesCheck.disabled = true;
    } else {
        o1CornersCheck.disabled = false;
        o1LinesCheck.disabled = false;
        
        // Clustering requires either corners or lines (for intersections)
        if (!o1CornersCheck.checked && !o1LinesCheck.checked) {
            o1ClusterCheck.disabled = true;
            o1ClusterCheck.checked = false;
        } else {
            o1ClusterCheck.disabled = false;
        }
    }
}

// Handle tab switching functionality
export function switchTab({tabName, apiResultsTab, tsResultsTab, ts2ResultsTab, apiResultContainer, 
    tsResultContainer, ts2ResultContainer, canvasContainer, annotatedURL, canvas, 
    tsImageProcessed, handleScanClick, FloorplanProcessingStrategy}) {
    
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
            clearCanvas(canvas.getContext('2d'), canvas);
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
            // Re-process the image
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