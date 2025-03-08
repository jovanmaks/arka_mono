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

// Point interface for wall detection
interface Point {
  x: number;
  y: number;
  type?: string;
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
 * Improved function to extract wall points from a skeleton image
 * Returns all foreground pixels from the image
 */
function extractWallPoints(imageData: ImageData): Point[] {
  const { width, height, data } = imageData;
  const points: Point[] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] > 0) {
        points.push({ x, y });
      }
    }
  }
  
  return points;
}

/**
 * Calculate distance from point to line
 */
function distToLine(point: Point, lineStart: Point, lineEnd: Point): number {
  const { x, y } = point;
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;
  
  // Line length
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  
  // If line is actually a point
  if (length === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  
  // Calculate distance from point to line
  const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / (length * length);
  
  if (t < 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  } else if (t > 1) {
    return Math.sqrt((x - x2) ** 2 + (y - y2) ** 2);
  }
  
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  
  return Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
}

/**
 * Improved function to connect wall points into line segments
 * This is a more robust version that works better with real floorplan data
 */
export function connectWallPoints(
  wallPoints: Point[],
  maxDistance: number = 5
): Line[] {
  if (wallPoints.length < 2) return [];
  
  const lines: Line[] = [];
  const visited = new Set<number>();
  
  // Use a sliding neighborhood approach to find aligned points
  for (let i = 0; i < wallPoints.length; i++) {
    if (visited.has(i)) continue;
    
    const p1 = wallPoints[i];
    visited.add(i);
    
    // Try each possible angle (quantized to improve performance)
    for (let angle = 0; angle < Math.PI; angle += Math.PI / 16) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Points that might belong to this line
      const linePoints: Point[] = [p1];
      
      // Find points that align with this angle starting from p1
      for (let j = 0; j < wallPoints.length; j++) {
        if (i === j || visited.has(j)) continue;
        
        const p2 = wallPoints[j];
        
        // Calculate how well this point aligns with our angle from p1
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        // Project the vector onto our angle direction
        const proj = dx * cos + dy * sin;
        
        // Calculate perpendicular distance
        // For a line with direction (cos, sin) passing through p1,
        // the perpendicular distance from p2 is |dx*sin - dy*cos|
        const perpDist = Math.abs(dx * sin - dy * cos);
        
        // If the point is close to our line and in the direction of our angle
        if (perpDist <= maxDistance) {
          linePoints.push(p2);
        }
      }
      
      // If we found enough points for a line
      if (linePoints.length >= 3) { // minimum points for a meaningful line
        // Sort points by their projection along the angle
        linePoints.sort((a, b) => {
          const projA = (a.x - p1.x) * cos + (a.y - p1.y) * sin;
          const projB = (b.x - p1.x) * cos + (b.y - p1.y) * sin;
          return projA - projB;
        });
        
        // Take the first and last point as endpoints
        const first = linePoints[0];
        const last = linePoints[linePoints.length - 1];
        
        // Mark all these points as visited
        for (let j = 1; j < linePoints.length - 1; j++) {
          const pointIndex = wallPoints.findIndex(p => 
            p.x === linePoints[j].x && p.y === linePoints[j].y);
          
          if (pointIndex >= 0) {
            visited.add(pointIndex);
          }
        }
        
        // Add line
        lines.push({
          x1: first.x,
          y1: first.y,
          x2: last.x,
          y2: last.y
        });
        
        // Once we find a good line with this starting point, move on
        break;
      }
    }
  }
  
  return lines;
}

/**
 * Detect straight walls in a skeletonized image using an improved approach
 * that better handles actual wall segments in a floorplan
 */
export function detectStraightWallsHough(
  skelImageData: ImageData,
  threshold: number = 50,
  minLineLength: number = 50,
  maxLineGap: number = 10,
  cornerPoints: Point[] = []
): Line[] {
  // Enhanced wall detection
  
  // First, try the direct point-based approach if we have corner points
  if (cornerPoints.length >= 2) {
    // Try to connect corner points directly
    const lines: Line[] = [];
    const maxDist = maxLineGap * 3; // Allow for larger gaps between corner points
    
    // Function to check if a line between points is valid (has foreground pixels)
    const checkValidLine = (p1: Point, p2: Point): boolean => {
      // Sample points along the line and check if enough of them are foreground
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const steps = Math.max(5, Math.ceil(dist / 5)); // Sample every 5 pixels
      
      let foregroundCount = 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(p1.x + t * dx);
        const y = Math.round(p1.y + t * dy);
        
        if (x >= 0 && x < skelImageData.width && y >= 0 && y < skelImageData.height) {
          const idx = (y * skelImageData.width + x) * 4;
          if (skelImageData.data[idx] > 0) {
            foregroundCount++;
          }
        }
      }
      
      // Return true if at least 40% of sampled points are foreground
      return foregroundCount >= (steps * 0.4);
    };
    
    // Try to connect all corner point pairs that are close enough
    for (let i = 0; i < cornerPoints.length; i++) {
      for (let j = i + 1; j < cornerPoints.length; j++) {
        const p1 = cornerPoints[i];
        const p2 = cornerPoints[j];
        
        const dist = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
        
        // Only connect points within a reasonable distance
        if (dist <= maxDist && checkValidLine(p1, p2)) {
          lines.push({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y
          });
        }
      }
    }
    
    // If we found lines with corner points, return them
    if (lines.length > 0) {
      console.log(`[INFO] Generated ${lines.length} lines using corner points directly`);
      return lines;
    }
  }

  // Extract all wall points from the skeleton
  const wallPoints = extractWallPoints(skelImageData);
  
  if (wallPoints.length > 0) {
    // Try our enhanced point-connection approach
    const maxDistance = Math.max(2, Math.min(5, maxLineGap / 2));
    const lines = connectWallPoints(wallPoints, maxDistance);
    
    // Filter lines that are too short
    const filteredLines = lines.filter(line => {
      const dx = line.x2 - line.x1;
      const dy = line.y2 - line.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      return length >= minLineLength;
    });
    
    console.log(`[INFO] Connected ${filteredLines.length} wall lines from ${wallPoints.length} points`);
    
    // If we found enough lines with our enhanced approach, return them
    if (filteredLines.length >= 3) {
      return filteredLines;
    }
  }
  
  // Fallback to Hough transform for complex cases
  console.log("[INFO] Falling back to Hough transform for line detection");
  
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