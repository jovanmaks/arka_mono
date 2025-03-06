// State management
let selectedFile = null;
let previewURL = null;
let annotatedURL = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const thresholdInput = document.getElementById('thresholdInput');
const clustersInput = document.getElementById('clustersInput');
const scanButton = document.getElementById('scanButton');
const clearButton = document.getElementById('clearButton');
const statusContainer = document.getElementById('statusContainer');
const resultContainer = document.getElementById('resultContainer');
const canvas = document.getElementById('floorplanCanvas');
const ctx = canvas.getContext('2d');

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Event Handlers
    fileInput.addEventListener('change', handleFileChange);
    scanButton.addEventListener('click', handleScanClick);
    clearButton.addEventListener('click', handleClear);
});

function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
        selectedFile = file;
        previewURL = URL.createObjectURL(file);
        scanButton.disabled = false;

        // Create and show preview image
        const previewImg = new Image();
        previewImg.src = previewURL;
        previewImg.style.maxWidth = '100%';
        previewImg.style.height = 'auto';
        previewImg.alt = 'Preview';

        previewContainer.innerHTML = '<p>Uploaded Image Preview:</p>';
        previewContainer.appendChild(previewImg);

        // Clear previous results
        annotatedURL = null;
        resultContainer.innerHTML = '';
        updateStatus('');
    }
}

async function handleScanClick() {
    if (!selectedFile) {
        updateStatus('No file selected!');
        return;
    }

    try {
        updateStatus('Processing...');

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
        updateStatus('Processing complete!');

        if (data.clusteredImagePath) {
            annotatedURL = `${baseUrl}/${data.clusteredImagePath}`;
            showResults(annotatedURL);
            drawOnCanvas(annotatedURL);
        } else {
            updateStatus('No annotated image path in the response.');
        }
    } catch (err) {
        console.error(err);
        updateStatus(`Error: ${err.message}`);
    }
}

function handleClear() {
    selectedFile = null;
    previewURL = null;
    annotatedURL = null;
    
    // Reset form
    fileInput.value = '';
    thresholdInput.value = '150';
    clustersInput.value = '150';
    scanButton.disabled = true;
    
    // Clear displays
    previewContainer.innerHTML = '';
    resultContainer.innerHTML = '';
    updateStatus('');
    
    // Clear canvas
    clearCanvas();
}

function updateStatus(message) {
    statusContainer.innerHTML = `<p>Status: ${message}</p>`;
}

function showResults(imageUrl) {
    resultContainer.innerHTML = `
        <div>
            <p>Annotated Skeleton:</p>
            <img src="${imageUrl}" alt="Annotated Skeleton" 
                 style="max-width: 100%; height: auto; border: 1px solid #ccc" />
        </div>
    `;
}

function clearCanvas() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function drawOnCanvas(imageUrl) {
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image
        ctx.drawImage(img, 0, 0);

        // Example: Draw a simple rectangle (you can customize this)
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 50, 200, 150);
    };
    img.src = imageUrl;
}