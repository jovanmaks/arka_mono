/**
 * Utility functions for floorplan processing application
 */

// Helper function to create an HTMLImageElement from a File
export function createImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

// Helper function to convert a grayscale ImageData to RGB
export function convertToRGB(imageData) {
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

// Update status message in the main status container
export function updateStatus(message, statusContainer) {
    statusContainer.innerHTML = `<p>Status: ${message}</p>`;
}

// Update status message in the results status container
export function updateResultsStatus(message, resultsStatusContainer) {
    if (resultsStatusContainer) {
        resultsStatusContainer.innerHTML = `<p>${message}</p>`;
    }
}

// Clear canvas
export function clearCanvas(ctx, canvas) {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
    }
}