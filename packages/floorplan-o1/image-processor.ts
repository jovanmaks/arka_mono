/**
 * Image processing utilities for the Floorplan O1 implementation
 */
import { ProcessingOptions } from "./types.ts";

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
 * Loads an image from a File or URL into an Image object
 */
export function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Allow cross-origin images if URL
    
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
 * Converts an ImageData to grayscale
 */
export function convertToGrayscale(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const grayImageData = ctx.createImageData(width, height);
  const grayData = grayImageData.data;
  
  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    // Standard grayscale conversion: 0.299*R + 0.587*G + 0.114*B
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    
    grayData[i] = gray;     // R
    grayData[i + 1] = gray; // G
    grayData[i + 2] = gray; // B
    grayData[i + 3] = data[i + 3]; // Keep original alpha
  }
  
  return grayImageData;
}

/**
 * Converts an ImageData to grayscale and applies binary thresholding.
 */
export function thresholdImage(
  imageData: ImageData, 
  threshold: number = 128, 
  inverse: boolean = true
): ImageData {
  const { width, height, data } = imageData;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const binImageData = ctx.createImageData(width, height);
  const binData = binImageData.data;
  
  // Convert to grayscale and threshold
  for (let i = 0; i < data.length; i += 4) {
    // Get luminance if not already grayscale
    const gray = data[i] === data[i + 1] && data[i] === data[i + 2] 
      ? data[i] 
      : 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      
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
 * Renders an ImageData to a canvas
 */
export function renderImageDataToCanvas(imageData: ImageData, canvas: HTMLCanvasElement): void {
  // Set canvas dimensions to match image dimensions exactly
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Draw the image data at its natural size
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Preprocesses an image for floorplan analysis
 * Performs grayscale conversion and thresholding
 */
export function preprocessImage(
  imageData: ImageData, 
  options?: ProcessingOptions
): ImageData {
  const threshold = options?.threshold || 128;
  const inverse = options?.inverse !== undefined ? options.inverse : true;
  
  // Apply thresholding directly
  return thresholdImage(imageData, threshold, inverse);
}