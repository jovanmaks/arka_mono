/**
 * Skeletonization implementation using Zhang-Suen thinning algorithm
 */
import { ProcessingOptions, SkeletonResult } from "./types.ts";
import { imageToImageData, loadImage, preprocessImage } from "./image-processor.ts";

/**
 * Performs morphological thinning (skeletonization) on a binary ImageData.
 * Uses the Zhang-Suen algorithm to reduce lines to 1-pixel thickness.
 */
export function zhangSuenThinning(
  imageData: ImageData, 
  maxIterations: number = 100
): ImageData {
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
  let iterations = 0;
  
  while (pixelsRemoved && iterations < maxIterations) {
    pixelsRemoved = false;
    iterations++;
    
    // First sub-iteration
    const toRemove1: [number, number][] = [];
    
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
    const toRemove2: [number, number][] = [];
    
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
 * Main function to skeletonize an image using the Zhang-Suen thinning algorithm
 */
export async function skeletonizeImage(
  imageSource: HTMLImageElement | string | File,
  options?: ProcessingOptions  
): Promise<SkeletonResult> {
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
  const threshold = options?.threshold ?? 128;
  const inverse = options?.inverse ?? true;
  const binaryImageData = preprocessImage(imageData, { threshold, inverse });
  console.log('[DEBUG] After preprocessing (grayscale + threshold)');
  
  // 3. Apply Zhang-Suen thinning algorithm for skeletonization
  const maxIterations = options?.maxIterations ?? 100;
  const skelImageData = zhangSuenThinning(binaryImageData, maxIterations);
  console.log('[DEBUG] After thinning with Zhang-Suen algorithm');
  
  // 4. Return the processed image with metadata
  return {
    skeleton: skelImageData,
    originalWidth,
    originalHeight,
    debugInfo: {
      thresholdValue: threshold,
      algorithm: "Zhang-Suen thinning algorithm"
    }
  };
}