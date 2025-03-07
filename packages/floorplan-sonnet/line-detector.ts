/**
 * Line Detector Module
 * 
 * This module provides functions to detect lines in a skeletonized image,
 * similar to the Python implementation's detect_straight_walls_hough function.
 */

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Apply Canny edge detection to an image
 * Similar to cv2.Canny
 */
export function cannyEdgeDetection(
  imageData: ImageData,
  lowThreshold: number = 50,
  highThreshold: number = 150
): ImageData {
  // For our purposes, the skeletonized image is already an edge map
  // So we'll just use it directly instead of implementing the full Canny algorithm
  
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(width * height * 4);
  
  // Copy the image data (we're assuming it's already binary)
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] > 0 ? 255 : 0;
    result[i] = val;
    result[i + 1] = val;
    result[i + 2] = val;
    result[i + 3] = 255;
  }
  
  return new ImageData(result, width, height);
}

/**
 * A simple implementation of Hough Transform to detect lines
 * Similar to cv2.HoughLinesP but simplified for TypeScript
 */
export function houghLinesP(
  imageData: ImageData,
  rho: number = 1,
  theta: number = Math.PI / 180,
  threshold: number = 50,
  minLineLength: number = 50,
  maxLineGap: number = 10
): Line[] {
  const { width, height, data } = imageData;
  
  // Maximum distance possible in the image
  const maxDistance = Math.sqrt(width * width + height * height);
  // Number of bins for rho and theta
  const numRho = Math.ceil(maxDistance / rho);
  const numTheta = Math.ceil(Math.PI / theta);
  
  // Initialize the accumulator
  const accumulator: number[][] = Array(numRho * 2)
    .fill(null)
    .map(() => Array(numTheta).fill(0));
  
  // Scan through the image and vote in the accumulator
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Only process edge pixels (non-zero)
      if (data[idx] === 0) continue;
      
      // For each theta, calculate rho and vote
      for (let thetaIdx = 0; thetaIdx < numTheta; thetaIdx++) {
        const thetaVal = thetaIdx * theta;
        
        // Calculate rho = x*cos(theta) + y*sin(theta)
        const rhoVal = x * Math.cos(thetaVal) + y * Math.sin(thetaVal);
        // Shift by maxDistance to handle negative rho
        const rhoIdx = Math.round((rhoVal + maxDistance) / rho);
        
        if (rhoIdx >= 0 && rhoIdx < numRho * 2) {
          accumulator[rhoIdx][thetaIdx]++;
        }
      }
    }
  }
  
  // Find local maxima in the accumulator
  const lines: Line[] = [];
  
  for (let rhoIdx = 0; rhoIdx < numRho * 2; rhoIdx++) {
    for (let thetaIdx = 0; thetaIdx < numTheta; thetaIdx++) {
      if (accumulator[rhoIdx][thetaIdx] >= threshold) {
        // Convert back to original space
        const thetaVal = thetaIdx * theta;
        const rhoVal = (rhoIdx * rho) - maxDistance;
        
        // Find points along this line
        const cos = Math.cos(thetaVal);
        const sin = Math.sin(thetaVal);
        
        // Find endpoints
        // This is a simplified approach compared to HoughLinesP
        // We'll just find two points on the line at the image boundaries
        
        // For vertical-ish lines
        if (Math.abs(sin) > 0.001) {
          // y = (rho - x*cos) / sin
          const x1 = 0;
          const y1 = Math.round(rhoVal / sin);
          const x2 = width - 1;
          const y2 = Math.round((rhoVal - x2 * cos) / sin);
          
          if (y1 >= 0 && y1 < height && y2 >= 0 && y2 < height) {
            lines.push({ x1, y1, x2, y2 });
          }
        } 
        // For horizontal-ish lines
        else if (Math.abs(cos) > 0.001) {
          // x = (rho - y*sin) / cos
          const y1 = 0;
          const x1 = Math.round(rhoVal / cos);
          const y2 = height - 1;
          const x2 = Math.round((rhoVal - y2 * sin) / cos);
          
          if (x1 >= 0 && x1 < width && x2 >= 0 && x2 < width) {
            lines.push({ x1, y1, x2, y2 });
          }
        }
      }
    }
  }
  
  // Filter lines that are too short
  return lines.filter(line => {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    return length >= minLineLength;
  });
}

/**
 * Detect straight walls in a skeletonized image using Hough Transform
 * Similar to the Python detect_straight_walls_hough function
 */
export function detectStraightWallsHough(
  skelImageData: ImageData,
  threshold: number = 50,
  minLineLength: number = 50,
  maxLineGap: number = 10
): Line[] {
  // First, apply edge detection (though our skeleton is already edges)
  const edges = cannyEdgeDetection(skelImageData, 50, 150);
  
  // Then detect lines using Hough Transform
  const lines = houghLinesP(
    edges,
    1,
    Math.PI / 180,
    threshold,
    minLineLength,
    maxLineGap
  );
  
  return lines;
}

/**
 * Draw detected lines on an image
 */
export function drawLines(imageData: ImageData, lines: Line[], color: [number, number, number] = [0, 255, 0]): void {
  const { width, height, data } = imageData;
  
  for (const line of lines) {
    const { x1, y1, x2, y2 } = line;
    
    // Bresenham's line algorithm
    let x = x1;
    let y = y1;
    
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
      // Check bounds
      if (x >= 0 && x < width && y >= 0 && y < height) {
        // Draw line pixel (make it thick - 3px wide)
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const px = x + kx;
            const py = y + ky;
            
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * 4;
              data[idx] = color[0];
              data[idx + 1] = color[1];
              data[idx + 2] = color[2];
            }
          }
        }
      }
      
      if (x === x2 && y === y2) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
}