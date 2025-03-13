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
    aiResultContainer.innerHTML = `
        <div>
            <h3>AI Results:</h3>
            <p>Successfully transformed the floorplan image.</p>
            <img src="${imageUrl}" alt="AI Transformed Floorplan" 
                 style="max-width: 100%; height: auto; border: 1px solid #ccc" />
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
export function switchTab({
    tabName, apiResultsTab, tsResultsTab, ts2ResultsTab, aiResultsTab,
    apiResultContainer, tsResultContainer, ts2ResultContainer, aiResultContainer,
    canvasContainer, annotatedURL, canvas, tsImageProcessed, handleScanClick, FloorplanProcessingStrategy
}) {
    // Remove active class from all tabs
    apiResultsTab.classList.remove('active');
    tsResultsTab.classList.remove('active');
    ts2ResultsTab.classList.remove('active');
    aiResultsTab.classList.remove('active');
    
    // Hide all result containers
    apiResultContainer.style.display = 'none';
    tsResultContainer.style.display = 'none';
    ts2ResultContainer.style.display = 'none';
    aiResultContainer.style.display = 'none';
    canvasContainer.style.display = 'none';
    
    // Show selected tab content
    switch (tabName) {
        case 'api':
            apiResultsTab.classList.add('active');
            apiResultContainer.style.display = 'block';
            break;
        case 'ts':
            tsResultsTab.classList.add('active');
            tsResultContainer.style.display = 'block';
            canvasContainer.style.display = tsImageProcessed ? 'block' : 'none';
            break;
        case 'ts2':
            ts2ResultsTab.classList.add('active');
            ts2ResultContainer.style.display = 'block';
            canvasContainer.style.display = 'block'; // Always show canvas for O1 strategy
            break;
        case 'ai':
            aiResultsTab.classList.add('active');
            aiResultContainer.style.display = 'block';
            break;
    }
}