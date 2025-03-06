/**
 * Skeletonize2 Module
 * 
 * This module provides an alternative implementation for skeletonizing floorplan images
 * based on Zhang-Suen thinning algorithm, optimized for detecting wall intersections.
 */

// Types
export type Point = { x: number, y: number };
export type LineSegment = { x1: number, y1: number, x2: number, y2: number };

// Interface compatible with the original skeletonize.ts module
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
 * Loads an image from a File or URL into an ImageData object (RGBA).
 * @param source - HTMLImageElement, string URL or Blob
 * @returns Promise that resolves to HTMLImageElement of the loaded image
 */
export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // allow cross-origin images if URL
    
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
 * Converts an ImageData to grayscale and applies binary thresholding.
 * @param imageData - Input ImageData (RGBA)
 * @param threshold - Threshold value (0-255)
 * @param inverse - Whether to invert the threshold result
 * @returns A new ImageData containing a binary image (pixels 0 or 255)
 */
export function preprocessImage(imageData: ImageData, threshold: number = 128, inverse: boolean = true): ImageData {
  const { width, height, data } = imageData;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const binImageData = ctx.createImageData(width, height);
  const binData = binImageData.data;
  
  // Convert to grayscale and threshold
  for (let i = 0; i < data.length; i += 4) {
    // Standard grayscale conversion: 0.299*R + 0.587*G + 0.114*B
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Apply threshold (with option to invert)
    const val = inverse ? 
      (gray < threshold ? 255 : 0) : 
      (gray > threshold ? 255 : 0);
    
    binData[i] = val;     // R
    binData[i + 1] = val; // G
    binData[i + 2] = val; // B
    binData[i + 3] = 255; // A (fully opaque)
  }
  
  return binImageData;
}

/**
 * Performs morphological thinning (skeletonization) on a binary ImageData.
 * Uses the Zhang-Suen algorithm to reduce lines to 1-pixel thickness.
 * @param imageData - Binary ImageData (white = foreground, black = background)
 * @returns New ImageData with thinned (skeletonized) binary image
 */
export function zhangSuenThinning(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  
  // Create a copy of the input data for processing
  const input = new Uint8ClampedArray(data);
  
  // Helper: get pixel value (1 for foreground, 0 for background)
  const getPixel = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    const idx = (y * width + x) * 4;
    return input[idx] > 0 ? 1 : 0;
  };
  
  // Helper: set pixel value
  const setPixel = (x: number, y: number, value: number): void => {
    const idx = (y * width + x) * 4;
    const val = value > 0 ? 255 : 0;
    input[idx] = input[idx + 1] = input[idx + 2] = val;
  };
  
  let pixelsRemoved = true;
  const maxIterations = 100; // Safety limit
  let iterations = 0;
  
  while (pixelsRemoved && iterations < maxIterations) {
    pixelsRemoved = false;
    iterations++;
    
    // First sub-iteration
    const toRemove1: Array<[number, number]> = [];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (getPixel(x, y) === 0) continue; // Skip background pixels
        
        // Get 8 neighbors (clockwise from top)
        const p2 = getPixel(x, y-1);   // North
        const p3 = getPixel(x+1, y-1); // Northeast
        const p4 = getPixel(x+1, y);   // East
        const p5 = getPixel(x+1, y+1); // Southeast
        const p6 = getPixel(x, y+1);   // South
        const p7 = getPixel(x-1, y+1); // Southwest
        const p8 = getPixel(x-1, y);   // West
        const p9 = getPixel(x-1, y-1); // Northwest
        
        const neighbors = [p2, p3, p4, p5, p6, p7, p8, p9];
        
        // Count foreground neighbors
        const neighborSum = neighbors.reduce((sum, val) => sum + val, 0);
        if (neighborSum < 2 || neighborSum > 6) continue;
        
        // Count 0->1 transitions in the ordered sequence
        let transitions = 0;
        for (let i = 0; i < neighbors.length; i++) {
          if (neighbors[i] === 0 && neighbors[(i + 1) % neighbors.length] === 1) {
            transitions++;
          }
        }
        if (transitions !== 1) continue;
        
        // Check first sub-iteration conditions
        // At least one of North, East, South is background
        if (p2 * p4 * p6 !== 0) continue;
        
        // At least one of East, South, West is background
        if (p4 * p6 * p8 !== 0) continue;
        
        // Mark for deletion
        toRemove1.push([x, y]);
      }
    }
    
    // Apply first sub-iteration deletions
    for (const [x, y] of toRemove1) {
      setPixel(x, y, 0);
      pixelsRemoved = true;
    }
    
    // Second sub-iteration
    const toRemove2: Array<[number, number]> = [];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (getPixel(x, y) === 0) continue;
        
        // Get 8 neighbors (clockwise from top)
        const p2 = getPixel(x, y-1);   // North
        const p3 = getPixel(x+1, y-1); // Northeast
        const p4 = getPixel(x+1, y);   // East
        const p5 = getPixel(x+1, y+1); // Southeast
        const p6 = getPixel(x, y+1);   // South
        const p7 = getPixel(x-1, y+1); // Southwest
        const p8 = getPixel(x-1, y);   // West
        const p9 = getPixel(x-1, y-1); // Northwest
        
        const neighbors = [p2, p3, p4, p5, p6, p7, p8, p9];
        
        // Count foreground neighbors
        const neighborSum = neighbors.reduce((sum, val) => sum + val, 0);
        if (neighborSum < 2 || neighborSum > 6) continue;
        
        // Count 0->1 transitions in the ordered sequence
        let transitions = 0;
        for (let i = 0; i < neighbors.length; i++) {
          if (neighbors[i] === 0 && neighbors[(i + 1) % neighbors.length] === 1) {
            transitions++;
          }
        }
        if (transitions !== 1) continue;
        
        // Check second sub-iteration conditions
        // At least one of North, East, West is background
        if (p2 * p4 * p8 !== 0) continue;
        
        // At least one of North, South, West is background
        if (p2 * p6 * p8 !== 0) continue;
        
        // Mark for deletion
        toRemove2.push([x, y]);
      }
    }
    
    // Apply second sub-iteration deletions
    for (const [x, y] of toRemove2) {
      setPixel(x, y, 0);
      pixelsRemoved = true;
    }
  }
  
  console.log(`[DEBUG] Thinning completed after ${iterations} iterations`);
  
  // Create output ImageData
  const result = new Uint8ClampedArray(input);
  return new ImageData(result, width, height);
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

/**
 * Skeletonize an image using the Zhang-Suen thinning algorithm
 * This is the main function that processes an image into a skeleton
 */
export async function skeletonize2Image(
  imageSource: HTMLImageElement | string | Blob,
  threshVal: number = 128
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
  
  // 2. Preprocess the image (convert to grayscale and threshold)
  const binaryImageData = preprocessImage(imageData, threshVal, true);
  console.log('[DEBUG] After preprocessing (grayscale + threshold)');
  
  // 3. Apply Zhang-Suen thinning algorithm for skeletonization
  const skelImageData = zhangSuenThinning(binaryImageData);
  console.log('[DEBUG] After thinning with Zhang-Suen algorithm');
  
  // 4. Return the processed image with metadata
  return {
    skeleton: skelImageData,
    originalWidth,
    originalHeight,
    debugInfo: {
      thresholdValue: threshVal,
      algorithm: "Zhang-Suen thinning algorithm"
    }
  };
}