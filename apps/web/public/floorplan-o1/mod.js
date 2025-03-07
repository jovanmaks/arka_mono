/**
 * Floorplan Processor O(1) Module
 * 
 * This module provides an alternative implementation for processing floorplan images
 * based on Zhang-Suen thinning algorithm, optimized for detecting wall intersections.
 */

// Types are removed in JavaScript
// export type Point = { x: number, y: number };
// export type LineSegment = { x1: number, y1: number, x2: number, y2: number };

/**
 * Convert an HTML Image element to a canvas and get its ImageData
 */
export function imageToImageData(img) {
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
 */
export function loadImage(src) {
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
 */
export function preprocessImage(imageData, threshold = 128, inverse = true) {
  const { width, height, data } = imageData;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
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
 */
export function zhangSuenThinning(imageData) {
  const { width, height, data } = imageData;
  
  // Create a copy of the input data for processing
  const input = new Uint8ClampedArray(data);
  
  // Helper: get pixel value (1 for foreground, 0 for background)
  const getPixel = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    const idx = (y * width + x) * 4;
    return input[idx] > 0 ? 1 : 0;
  };
  
  // Helper: set pixel value
  const setPixel = (x, y, value) => {
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
    const toRemove1 = [];
    
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
    const toRemove2 = [];
    
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
export function renderImageDataToCanvas(imageData, canvas) {
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
export async function skeletonize2Image(imageSource, threshVal = 128) {
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

/**
 * Detects corner points in a binary image using the Harris corner detection technique.
 * This is an implementation specifically optimized for detecting wall intersections in floorplans.
 * 
 * @param {ImageData} imageData - Skeletonized binary image
 * @returns {Array} Array of detected corner points {x, y}
 */
export function detectCorners(imageData) {
  const { width, height, data } = imageData;
  const corners = [];

  // Helper function to check if a pixel is a corner candidate
  const isCornerCandidate = (x, y) => {
    if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) return false;
    
    // Check if this is a foreground pixel
    const idx = (y * width + x) * 4;
    if (data[idx] === 0) return false;
    
    // Count neighbors (in 3x3 window)
    let neighborCount = 0;
    let transitions = 0;
    const neighborVals = [];

    // Collect neighbor values in 8-connected neighborhood
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        if (i === 0 && j === 0) continue; // Skip center pixel
        
        const nx = x + i;
        const ny = y + j;
        const nidx = (ny * width + nx) * 4;
        
        const val = data[nidx] > 0 ? 1 : 0;
        neighborVals.push(val);
        if (val === 1) neighborCount++;
      }
    }

    // Count 0->1 transitions in circular order
    for (let i = 0; i < neighborVals.length; i++) {
      if (neighborVals[i] === 0 && neighborVals[(i + 1) % 8] === 1) {
        transitions++;
      }
    }

    // A corner should have 3 or more foreground neighbors
    // and either 2 or more transitions (for T-junction or X-crossing)
    return neighborCount >= 3 && transitions >= 2;
  };

  // Scan the image for corner candidates
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (isCornerCandidate(x, y)) {
        corners.push({ x, y });
      }
    }
  }

  console.log(`[DEBUG] Detected ${corners.length} corner candidates`);
  return corners;
}

/**
 * Clusters nearby points into a single point using distance-based clustering.
 * 
 * @param {Array} points - Array of points {x, y}
 * @param {Number} maxDistance - Maximum distance for points to be in the same cluster
 * @returns {Array} Array of clustered points (centroids)
 */
export function clusterPoints(points, maxDistance = 10) {
  if (points.length === 0) return [];

  // Create clusters initially containing one point each
  const clusters = points.map(point => [point]);
  let mergeOccurred = true;

  // Iteratively merge clusters until no more merges occur
  while (mergeOccurred) {
    mergeOccurred = false;

    for (let i = 0; i < clusters.length; i++) {
      if (!clusters[i]) continue; // Skip already merged clusters

      for (let j = i + 1; j < clusters.length; j++) {
        if (!clusters[j]) continue; // Skip already merged clusters

        // Check distance between clusters
        const canMerge = clusters[i].some(p1 => 
          clusters[j].some(p2 => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return Math.sqrt(dx*dx + dy*dy) <= maxDistance;
          })
        );

        // Merge clusters if they're close enough
        if (canMerge) {
          clusters[i] = clusters[i].concat(clusters[j]);
          clusters[j] = null; // Mark as merged
          mergeOccurred = true;
        }
      }
    }

    // Filter out null clusters
    if (mergeOccurred) {
      clusters = clusters.filter(cluster => cluster !== null);
    }
  }

  // Calculate centroids (averages) for each cluster
  return clusters.map(cluster => {
    const sumX = cluster.reduce((sum, p) => sum + p.x, 0);
    const sumY = cluster.reduce((sum, p) => sum + p.y, 0);
    return { 
      x: Math.round(sumX / cluster.length), 
      y: Math.round(sumY / cluster.length) 
    };
  });
}

/**
 * Detects straight line segments in the skeleton image using Hough transform approach.
 * 
 * @param {ImageData} imageData - Binary image data
 * @param {Number} threshold - Minimum votes for line detection
 * @param {Number} minLineLength - Minimum length of detected lines
 * @param {Number} maxLineGap - Maximum gap between collinear line segments
 * @returns {Array} Array of detected line segments { x1, y1, x2, y2 }
 */
export function detectStraightLines(imageData, threshold = 30, minLineLength = 20, maxLineGap = 5) {
  const { width, height, data } = imageData;
  const lines = [];
  
  // Extract foreground pixel coordinates
  const points = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] > 0) {
        points.push({x, y});
      }
    }
  }
  
  // Simple implementation of probabilistic Hough transform
  // We'll use a simplified approach by checking groups of points
  // and finding straight lines among them
  const angleStep = Math.PI / 180;
  const maxDistance = 5; // Max distance for points to be considered on same line
  
  // Group points by potential lines
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    
    for (let angleIdx = 0; angleIdx < 180; angleIdx++) {
      const theta = angleIdx * angleStep;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      // Find points that lie on this angle from p1
      const potentialLinePoints = [];
      potentialLinePoints.push(p1);
      
      // Check other points to see if they lie close to this line
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        
        const p2 = points[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        // Distance from point to line
        const dist = Math.abs(-sinTheta * p2.x + cosTheta * p2.y - 
                              (-sinTheta * p1.x + cosTheta * p1.y));
        
        if (dist <= maxDistance) {
          potentialLinePoints.push(p2);
        }
      }
      
      // If we have enough points, consider this a line
      if (potentialLinePoints.length >= threshold) {
        // Sort points to find endpoints
        potentialLinePoints.sort((a, b) => {
          return (a.x - p1.x) * cosTheta + (a.y - p1.y) * sinTheta - 
                 ((b.x - p1.x) * cosTheta + (b.y - p1.y) * sinTheta);
        });
        
        // Get first and last point of sorted array as line endpoints
        const first = potentialLinePoints[0];
        const last = potentialLinePoints[potentialLinePoints.length - 1];
        
        // Calculate length
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const length = Math.sqrt(dx*dx + dy*dy);
        
        // Add line if it meets length requirement
        if (length >= minLineLength) {
          lines.push({
            x1: first.x,
            y1: first.y,
            x2: last.x,
            y2: last.y
          });
        }
      }
    }
  }
  
  // Filter duplicate lines
  const filteredLines = [];
  for (const line of lines) {
    const isDuplicate = filteredLines.some(l => {
      const d1 = Math.hypot(l.x1 - line.x1, l.y1 - line.y1) + 
                Math.hypot(l.x2 - line.x2, l.y2 - line.y2);
      const d2 = Math.hypot(l.x1 - line.x2, l.y1 - line.y2) + 
                Math.hypot(l.x2 - line.x1, l.y2 - line.y1);
      return d1 <= maxLineGap*2 || d2 <= maxLineGap*2;
    });
    
    if (!isDuplicate) {
      filteredLines.push(line);
    }
  }
  
  console.log(`[DEBUG] Detected ${filteredLines.length} line segments`);
  return filteredLines;
}

/**
 * Draws detected corners on an image.
 * 
 * @param {ImageData} imageData - Image to draw on
 * @param {Array} corners - Array of corner points {x, y}
 * @param {Boolean} useOriginal - If true, modifies input imageData; otherwise makes a copy
 * @returns {ImageData} Modified image with corners highlighted
 */
export function drawCorners(imageData, corners, useOriginal = false) {
  const { width, height } = imageData;
  
  // Create a copy of the input image if needed
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  
  // Helper to set pixel color (RGB)
  const setPixelColor = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = (y * width + x) * 4;
    result.data[idx] = r;
    result.data[idx + 1] = g;
    result.data[idx + 2] = b;
  };
  
  // Draw a small circle at each corner
  for (const { x, y } of corners) {
    // Draw a 3x3 red marker
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        setPixelColor(x + dx, y + dy, 255, 0, 0); // Red
      }
    }
  }
  
  return result;
}

/**
 * Draws clustered points on the image.
 *
 * @param {ImageData} imageData - Image to draw on
 * @param {Array} clusters - Array of cluster points {x, y}
 * @param {Boolean} useOriginal - If true, modifies input imageData; otherwise makes a copy
 * @returns {ImageData} Modified image with clustered points highlighted
 */
export function drawClusteredPoints(imageData, clusters, useOriginal = false) {
  const { width, height } = imageData;
  
  // Create a copy of the input image if needed
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  
  // Helper to set pixel color (RGB)
  const setPixelColor = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = (y * width + x) * 4;
    result.data[idx] = r;
    result.data[idx + 1] = g;
    result.data[idx + 2] = b;
  };
  
  // Draw a larger circle for each cluster centroid
  for (const { x, y } of clusters) {
    // Draw a 5x5 green marker
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        // Make the center brighter
        const intensity = (dx === 0 && dy === 0) ? 255 : 180;
        setPixelColor(x + dx, y + dy, 0, intensity, 0); // Green
      }
    }
  }
  
  return result;
}

/**
 * Draws detected lines on the image.
 *
 * @param {ImageData} imageData - Image to draw on
 * @param {Array} lines - Array of line segments {x1, y1, x2, y2}
 * @param {Boolean} useOriginal - If true, modifies input imageData; otherwise makes a copy
 * @returns {ImageData} Modified image with lines highlighted
 */
export function drawLines(imageData, lines, useOriginal = false) {
  const { width, height } = imageData;
  
  // Create a copy of the input image if needed
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  
  // Helper to set pixel color (RGB)
  const setPixelColor = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = (y * width + x) * 4;
    result.data[idx] = r;
    result.data[idx + 1] = g;
    result.data[idx + 2] = b;
  };
  
  // Bresenham line algorithm to draw lines
  const drawLine = (x1, y1, x2, y2, r, g, b) => {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
      setPixelColor(x1, y1, r, g, b);
      
      if (x1 === x2 && y1 === y2) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x1 += sx; }
      if (e2 < dx) { err += dx; y1 += sy; }
    }
  };
  
  // Draw each line in blue
  for (const { x1, y1, x2, y2 } of lines) {
    drawLine(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), 0, 0, 255);
  }
  
  return result;
}

/**
 * Calculate intersection point of two lines (if any).
 * 
 * @param {Object} line1 - First line segment {x1, y1, x2, y2}
 * @param {Object} line2 - Second line segment {x1, y1, x2, y2}
 * @returns {Object|null} Point of intersection {x, y} or null if no intersection
 */
export function intersectLines(line1, line2) {
  // Represent line1 in parametric form: P1 + t*(P2-P1)
  const {x1, y1, x2, y2} = line1;
  const {x1: x3, y1: y3, x2: x4, y2: y4} = line2;
  
  // Compute denominator
  const denom = (x1 - x2)*(y3 - y4) - (y1 - y2)*(x3 - x4);
  if (Math.abs(denom) < 1e-6) {
    return null; // lines are parallel or nearly parallel
  }
  
  // Intersection point
  const intersectX = ((x1*y2 - y1*x2)*(x3 - x4) - (x1 - x2)*(x3*y4 - y3*x4)) / denom;
  const intersectY = ((x1*y2 - y1*x2)*(y3 - y4) - (y1 - y2)*(x3*y4 - y3*x4)) / denom;
  
  // Check if intersection is within the line segments
  const between = (a, b, c) => (a >= Math.min(b, c) - 1e-6 && a <= Math.max(b, c) + 1e-6);
  if (
    between(intersectX, x1, x2) && between(intersectY, y1, y2) &&
    between(intersectX, x3, x4) && between(intersectY, y3, y4)
  ) {
    return { x: intersectX, y: intersectY };
  }
  
  return null;
}

/**
 * Find all intersection points between the detected lines
 * 
 * @param {Array} lines - Array of line segments {x1, y1, x2, y2}
 * @returns {Array} Array of intersection points {x, y}
 */
export function findIntersections(lines) {
  const points = [];
  
  // Check all unique line pairs for intersections
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const intersection = intersectLines(lines[i], lines[j]);
      if (intersection) {
        points.push(intersection);
      }
    }
  }
  
  return points;
}