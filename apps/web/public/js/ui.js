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

// Show AI Transformation results
export function showTransformResults(imageUrl, aiResultContainer) {
    // Clear previous content and show loading indicator
    aiResultContainer.innerHTML = `
        <div>
            <h3>AI Results:</h3>
            <p>Loading visualization...</p>
        </div>
    `;
    
    // Create an image element to test loading
    const img = new Image();
    
    // Handle image load success
    img.onload = () => {
        aiResultContainer.innerHTML = `
            <div>
                <h3>AI Results:</h3>
                <p>Successfully transformed the floorplan image.</p>
                <img src="${imageUrl}" alt="AI Transformed Floorplan" 
                     style="max-width: 100%; height: auto; border: 1px solid #ccc" />
            </div>
        `;
    };
    
    // Handle image load error
    img.onerror = () => {
        console.error(`Failed to load image: ${imageUrl}`);
        aiResultContainer.innerHTML = `
            <div>
                <h3>AI Results:</h3>
                <p>Error loading visualization image. Please try another option.</p>
                <p class="error-details">Failed to load: ${imageUrl}</p>
                <style>.error-details { color: red; font-size: 0.8em; }</style>
            </div>
        `;
    };
    
    // Start loading the image
    img.src = imageUrl;
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
export function switchTab({
    tabName, apiResultsTab, tsResultsTab, ts2ResultsTab, aiResultsTab,
    apiResultContainer, tsResultContainer, ts2ResultContainer, aiResultContainer,
    canvasContainer, annotatedURL, canvas, tsImageProcessed, handleScanClick, FloorplanProcessingStrategy
}) {
    // Safety check to ensure all required DOM elements exist
    if (!apiResultsTab || !tsResultsTab || !ts2ResultsTab || !aiResultsTab ||
        !apiResultContainer || !tsResultContainer || !ts2ResultContainer || !aiResultContainer) {
        console.error('Tab switching error: Required DOM elements are missing');
        return;
    }

    console.log(`Switching to tab: ${tabName}`);

    // Don't clear canvas on tab switch - we'll handle canvas content with strategy-specific logic

    // Remove active class from all tabs
    apiResultsTab.classList.remove('active');
    tsResultsTab.classList.remove('active');
    ts2ResultsTab.classList.remove('active');
    aiResultsTab.classList.remove('active');
    
    // Hide all result containers safely
    if (apiResultContainer) apiResultContainer.style.display = 'none';
    if (tsResultContainer) tsResultContainer.style.display = 'none';
    if (ts2ResultContainer) ts2ResultContainer.style.display = 'none';
    if (aiResultContainer) aiResultContainer.style.display = 'none';
    if (canvasContainer) canvasContainer.style.display = 'none';
    
    // Show selected tab content
    switch (tabName) {
        case 'api':
            apiResultsTab.classList.add('active');
            apiResultContainer.style.display = 'block';
            // Show canvas only if we have an annotated image URL
            if (canvasContainer && annotatedURL) {
                canvasContainer.style.display = 'block';
            }
            break;
        case 'ts':
            tsResultsTab.classList.add('active');
            tsResultContainer.style.display = 'block';
            if (canvasContainer && tsImageProcessed) {
                canvasContainer.style.display = 'block';
                // Canvas content will be handled by the tab click handler in main.js
            }
            break;
        case 'ts2':
            ts2ResultsTab.classList.add('active');
            ts2ResultContainer.style.display = 'block';
            if (canvasContainer) {
                canvasContainer.style.display = 'block'; // Always show canvas for O1 strategy
                // Canvas content will be handled by the tab click handler in main.js
            }
            break;
        case 'ai':
            aiResultsTab.classList.add('active');
            aiResultContainer.style.display = 'block';
            break;
    }
}