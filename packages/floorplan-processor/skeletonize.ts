/**
 * Skeletonize Module
 * 
 * This module provides functions to process floorplan images and extract skeletons
 * using OpenCV.js. It mimics the Python implementation's functionality but uses
 * browser-compatible image processing.
 */

// Types for our image processing functions
export interface ProcessedImage {
  /** The skeletonized image data */
  skeleton: ImageData;
  /** The original image width */
  originalWidth: number;
  /** The original image height */
  originalHeight: number;
  /** Debug information */
  debugInfo: Record<string, any>;
}

/**
 * Convert an HTML Image element to a canvas and get its ImageData
 */
export function imageToImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert an ImageData object to grayscale
 */
export function convertToGrayscale(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const grayscaleData = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < data.length; i += 4) {
    // Standard grayscale conversion: 0.299*R + 0.587*G + 0.114*B
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grayscaleData[i] = gray;     // R
    grayscaleData[i + 1] = gray; // G
    grayscaleData[i + 2] = gray; // B
    grayscaleData[i + 3] = data[i + 3]; // A
  }
  
  return new ImageData(grayscaleData, width, height);
}

/**
 * Threshold an image (convert to binary)
 * @param imageData The image data to threshold
 * @param threshold Threshold value (0-255)
 * @param inverse If true, will invert the threshold (THRESH_BINARY_INV)
 */
export function threshold(imageData: ImageData, threshold: number, inverse: boolean = true): ImageData {
  const { data, width, height } = imageData;
  const resultData = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < data.length; i += 4) {
    // For each pixel, check if it's above or below threshold
    const gray = data[i]; // We assume it's already grayscale
    const value = inverse ? (gray < threshold ? 255 : 0) : (gray > threshold ? 255 : 0);
    
    resultData[i] = value;     // R
    resultData[i + 1] = value; // G
    resultData[i + 2] = value; // B
    resultData[i + 3] = data[i + 3]; // A
  }
  
  return new ImageData(resultData, width, height);
}

/**
 * Apply morphological erosion to an image
 * Similar to cv2.erode
 */
export function erode(imageData: ImageData, kernelSize: number = 3): ImageData {
  const { width, height } = imageData;
  const result = new Uint8ClampedArray(width * height * 4);
  
  // First, create a copy of the input
  result.set(imageData.data);
  
  const halfKernel = Math.floor(kernelSize / 2);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) {
    throw new Error('Failed to get temporary canvas context');
  }
  
  tempCtx.putImageData(imageData, 0, 0);
  const sourceImageData = tempCtx.getImageData(0, 0, width, height);
  
  // Apply erosion: for each pixel, take the minimum value in the neighborhood
  for (let y = halfKernel; y < height - halfKernel; y++) {
    for (let x = halfKernel; x < width - halfKernel; x++) {
      let minValue = 255;
      
      // Check all pixels in the kernel
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const pos = ((y + ky) * width + (x + kx)) * 4;
          // Take minimum value in the kernel
          minValue = Math.min(minValue, sourceImageData.data[pos]);
        }
      }
      
      const pos = (y * width + x) * 4;
      result[pos] = minValue;
      result[pos + 1] = minValue;
      result[pos + 2] = minValue;
      // Keep alpha unchanged
    }
  }
  
  return new ImageData(result, width, height);
}

/**
 * Apply morphological dilation to an image
 * Similar to cv2.dilate
 */
export function dilate(imageData: ImageData, kernelSize: number = 3): ImageData {
  const { width, height } = imageData;
  const result = new Uint8ClampedArray(width * height * 4);
  
  // First, create a copy of the input
  result.set(imageData.data);
  
  const halfKernel = Math.floor(kernelSize / 2);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) {
    throw new Error('Failed to get temporary canvas context');
  }
  
  tempCtx.putImageData(imageData, 0, 0);
  const sourceImageData = tempCtx.getImageData(0, 0, width, height);
  
  // Apply dilation: for each pixel, take the maximum value in the neighborhood
  for (let y = halfKernel; y < height - halfKernel; y++) {
    for (let x = halfKernel; x < width - halfKernel; x++) {
      let maxValue = 0;
      
      // Check all pixels in the kernel
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const pos = ((y + ky) * width + (x + kx)) * 4;
          // Take maximum value in the kernel
          maxValue = Math.max(maxValue, sourceImageData.data[pos]);
        }
      }
      
      const pos = (y * width + x) * 4;
      result[pos] = maxValue;
      result[pos + 1] = maxValue;
      result[pos + 2] = maxValue;
      // Keep alpha unchanged
    }
  }
  
  return new ImageData(result, width, height);
}

/**
 * Apply morphological opening (erosion followed by dilation)
 * Similar to cv2.morphologyEx with MORPH_OPEN
 */
export function morphologicalOpen(imageData: ImageData, kernelSize: number = 3): ImageData {
  // Opening = Erosion followed by dilation
  const eroded = erode(imageData, kernelSize);
  return dilate(eroded, kernelSize);
}

/**
 * Apply morphological closing (dilation followed by erosion)
 * Similar to cv2.morphologyEx with MORPH_CLOSE
 */
export function morphologicalClose(imageData: ImageData, kernelSize: number = 3): ImageData {
  // Closing = Dilation followed by erosion
  const dilated = dilate(imageData, kernelSize);
  return erode(dilated, kernelSize);
}

/**
 * Skeletonize a binary image using morphological operations
 * This is an implementation of the Zhang-Suen thinning algorithm,
 * which is similar to what OpenCV's ximgproc.thinning uses
 */
export function morphologicalThinning(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const result = new Uint8ClampedArray(width * height * 4);
  
  // Copy the original image data
  let current = new Uint8ClampedArray(imageData.data);
  let changed = true;
  
  // Convert to binary (0 and 1)
  for (let i = 0; i < current.length; i += 4) {
    current[i] = current[i] > 128 ? 1 : 0;
    current[i + 1] = current[i];
    current[i + 2] = current[i];
    current[i + 3] = 255; // Full alpha
  }
  
  const iterations = 0; // Safety counter to prevent infinite loops
  const maxIterations = 100;
  
  // Zhang-Suen thinning algorithm
  while (changed && iterations < maxIterations) {
    changed = false;
    
    // First sub-iteration
    const markedPoints = [];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = (y * width + x) * 4;
        
        // Skip if not a foreground pixel
        if (current[p] === 0) continue;
        
        // Get 8-neighbors (clockwise)
        const p2 = ((y-1) * width + x) * 4;
        const p3 = ((y-1) * width + (x+1)) * 4;
        const p4 = (y * width + (x+1)) * 4;
        const p5 = ((y+1) * width + (x+1)) * 4;
        const p6 = ((y+1) * width + x) * 4;
        const p7 = ((y+1) * width + (x-1)) * 4;
        const p8 = (y * width + (x-1)) * 4;
        const p9 = ((y-1) * width + (x-1)) * 4;
        
        const values = [
          current[p2], current[p3], current[p4], current[p5],
          current[p6], current[p7], current[p8], current[p9]
        ];
        
        // Count non-zero neighbors
        const nonZeroNeighbors = values.reduce((a, b) => a + b, 0);
        
        if (nonZeroNeighbors < 2 || nonZeroNeighbors > 6) continue;
        
        // Count transitions from 0 to 1 in the ordered sequence
        let transitions = 0;
        for (let i = 0; i < values.length; i++) {
          if (values[i] === 0 && values[(i+1) % values.length] === 1) {
            transitions++;
          }
        }
        
        if (transitions !== 1) continue;
        
        // Check if p2 * p4 * p6 == 0
        if (current[p2] * current[p4] * current[p6] !== 0) continue;
        
        // Check if p4 * p6 * p8 == 0
        if (current[p4] * current[p6] * current[p8] !== 0) continue;
        
        // Mark for deletion
        markedPoints.push(p);
        changed = true;
      }
    }
    
    // Delete marked points
    for (const p of markedPoints) {
      current[p] = 0;
      current[p + 1] = 0;
      current[p + 2] = 0;
    }
    
    // Second sub-iteration
    markedPoints.length = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = (y * width + x) * 4;
        
        // Skip if not a foreground pixel
        if (current[p] === 0) continue;
        
        // Get 8-neighbors (clockwise)
        const p2 = ((y-1) * width + x) * 4;
        const p3 = ((y-1) * width + (x+1)) * 4;
        const p4 = (y * width + (x+1)) * 4;
        const p5 = ((y+1) * width + (x+1)) * 4;
        const p6 = ((y+1) * width + x) * 4;
        const p7 = ((y+1) * width + (x-1)) * 4;
        const p8 = (y * width + (x-1)) * 4;
        const p9 = ((y-1) * width + (x-1)) * 4;
        
        const values = [
          current[p2], current[p3], current[p4], current[p5],
          current[p6], current[p7], current[p8], current[p9]
        ];
        
        // Count non-zero neighbors
        const nonZeroNeighbors = values.reduce((a, b) => a + b, 0);
        
        if (nonZeroNeighbors < 2 || nonZeroNeighbors > 6) continue;
        
        // Count transitions from 0 to 1 in the ordered sequence
        let transitions = 0;
        for (let i = 0; i < values.length; i++) {
          if (values[i] === 0 && values[(i+1) % values.length] === 1) {
            transitions++;
          }
        }
        
        if (transitions !== 1) continue;
        
        // Check if p2 * p4 * p8 == 0
        if (current[p2] * current[p4] * current[p8] !== 0) continue;
        
        // Check if p2 * p6 * p8 == 0
        if (current[p2] * current[p6] * current[p8] !== 0) continue;
        
        // Mark for deletion
        markedPoints.push(p);
        changed = true;
      }
    }
    
    // Delete marked points
    for (const p of markedPoints) {
      current[p] = 0;
      current[p + 1] = 0;
      current[p + 2] = 0;
    }
  }
  
  // Convert binary back to 0 and 255
  for (let i = 0; i < current.length; i += 4) {
    const val = current[i] === 1 ? 255 : 0;
    result[i] = val;
    result[i + 1] = val;
    result[i + 2] = val;
    result[i + 3] = 255; // Full alpha
  }
  
  return new ImageData(result, width, height);
}

/**
 * Skeletonize an image
 * This is the main function that processes an image into a skeleton,
 * similar to the Python skeletonize_image function
 */
export async function skeletonizeImage(
  imageSource: HTMLImageElement | string | Blob,
  threshVal: number = 100
): Promise<ProcessedImage> {
  // Load the image if it's a string URL or blob
  const img = imageSource instanceof HTMLImageElement 
    ? imageSource 
    : await loadImage(imageSource);
  
  const originalWidth = img.width;
  const originalHeight = img.height;
  
  console.log(`[DEBUG] Original (H×W): ${originalHeight} × ${originalWidth}`);
  
  // 1. Convert to ImageData
  const imageData = imageToImageData(img);
  
  // 2. Convert to grayscale
  const grayImageData = convertToGrayscale(imageData);
  console.log('[DEBUG] After grayscale conversion');
  
  // 3. Threshold
  const binaryImageData = threshold(grayImageData, threshVal, true);
  console.log('[DEBUG] After threshold');
  
  // 4. Morphological opening/closing
  const openedImageData = morphologicalOpen(binaryImageData, 3);
  console.log('[DEBUG] After open');
  const closedImageData = morphologicalClose(openedImageData, 3);
  console.log('[DEBUG] After close');
  
  // 5. Thinning (skeletonization)
  const skelImageData = morphologicalThinning(closedImageData);
  console.log('[DEBUG] After thinning');
  
  // 6. Return the processed image with metadata
  return {
    skeleton: skelImageData,
    originalWidth,
    originalHeight,
    debugInfo: {
      thresholdValue: threshVal
    }
  };
}

/**
 * Helper function to load an image from URL or Blob
 */
export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    
    if (typeof src === 'string') {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

/**
 * Helper function to render an ImageData to a canvas
 */
export function renderImageDataToCanvas(
  imageData: ImageData, 
  canvas: HTMLCanvasElement
): void {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  ctx.putImageData(imageData, 0, 0);
}