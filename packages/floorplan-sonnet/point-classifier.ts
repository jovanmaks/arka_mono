/**
 * Point Classifier Module
 * 
 * This module provides functions to identify key points in a skeletonized image,
 * such as corners, endpoints, and T-junctions, similar to the Python implementation.
 */

// Define point types
export type PointType = 'endpoint' | 'corner' | 't_junction' | 'none';

export interface Point {
  x: number;
  y: number;
  type?: PointType;
}

/**
 * Classifies a point based on its 3x3 neighborhood pattern
 * Similar to the Python classify_point function
 * 
 * @param neighborhood A 3x3 array of pixel values (0 or 255)
 * @returns The point type: 'endpoint', 'corner', 't_junction', or 'none'
 */
export function classifyPoint(neighborhood: Uint8ClampedArray | number[][]): PointType {
  // Convert to binary pattern (0 or 1)
  let pattern: number[];
  
  if (Array.isArray(neighborhood)) {
    // Handle 2D array input
    if (neighborhood.length !== 3 || neighborhood[0].length !== 3) {
      throw new Error('Neighborhood must be a 3x3 array');
    }
    
    // Extract center value
    const center = neighborhood[1][1] > 0 ? 1 : 0;
    if (center === 0) return 'none';
    
    // Convert to 1D array of 8 neighbors in clockwise order
    pattern = [
      neighborhood[0][1] > 0 ? 1 : 0, // Top
      neighborhood[0][2] > 0 ? 1 : 0, // Top-right
      neighborhood[1][2] > 0 ? 1 : 0, // Right
      neighborhood[2][2] > 0 ? 1 : 0, // Bottom-right
      neighborhood[2][1] > 0 ? 1 : 0, // Bottom
      neighborhood[2][0] > 0 ? 1 : 0, // Bottom-left
      neighborhood[1][0] > 0 ? 1 : 0, // Left
      neighborhood[0][0] > 0 ? 1 : 0  // Top-left
    ];
  } else {
    // Handle Uint8ClampedArray input (assuming RGBA format)
    if (neighborhood.length !== 36) { // 3x3 neighborhood with 4 channels
      throw new Error('Neighborhood must contain 9 pixels (36 values in RGBA format)');
    }
    
    // Extract center value
    const center = neighborhood[4 * 4 + 0] > 0 ? 1 : 0; // Center pixel's R value
    if (center === 0) return 'none';
    
    // Convert to 1D array of 8 neighbors in clockwise order
    pattern = [
      neighborhood[4 * 1 + 0] > 0 ? 1 : 0, // Top
      neighborhood[4 * 2 + 0] > 0 ? 1 : 0, // Top-right
      neighborhood[4 * 5 + 0] > 0 ? 1 : 0, // Right
      neighborhood[4 * 8 + 0] > 0 ? 1 : 0, // Bottom-right
      neighborhood[4 * 7 + 0] > 0 ? 1 : 0, // Bottom
      neighborhood[4 * 6 + 0] > 0 ? 1 : 0, // Bottom-left
      neighborhood[4 * 3 + 0] > 0 ? 1 : 0, // Left
      neighborhood[4 * 0 + 0] > 0 ? 1 : 0  // Top-left
    ];
  }
  
  // Count neighbors
  const neighbors = pattern.reduce((sum, val) => sum + val, 0);
  
  // Count transitions from 0 to 1
  let transitions = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === 0 && pattern[(i + 1) % pattern.length] === 1) {
      transitions++;
    }
  }
  
  // Logic (same as Python version)
  if (neighbors === 1) {
    return 'endpoint';
  } else if (transitions === 2) {
    if (neighbors === 2) {
      return 'corner';
    } else if (neighbors === 3) {
      return 't_junction';
    }
  }
  
  return 'none';
}

/**
 * Extract a 3x3 neighborhood from an ImageData at position (x,y)
 */
function getNeighborhood(imageData: ImageData, x: number, y: number): Uint8ClampedArray | null {
  const { width, height, data } = imageData;
  
  // Check bounds
  if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) {
    return null;
  }
  
  // Extract 3x3 neighborhood
  const neighborhood = new Uint8ClampedArray(36); // 3x3 with 4 channels
  
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const srcIdx = ((y + dy) * width + (x + dx)) * 4;
      const dstIdx = ((dy + 1) * 3 + (dx + 1)) * 4;
      
      neighborhood[dstIdx] = data[srcIdx];         // R
      neighborhood[dstIdx + 1] = data[srcIdx + 1]; // G
      neighborhood[dstIdx + 2] = data[srcIdx + 2]; // B
      neighborhood[dstIdx + 3] = data[srcIdx + 3]; // A
    }
  }
  
  return neighborhood;
}

/**
 * Detect corners, endpoints and T-junctions in a skeletonized image
 * Similar to the Python detect_corners function
 */
export function detectCorners(
  skelImageData: ImageData,
  maxCorners: number = 500,
  qualityLevel: number = 0.001,
  minDistance: number = 10
): Point[] {
  const { width, height, data } = skelImageData;
  const importantPoints: Point[] = [];
  
  // First pass: look for corners (we don't have goodFeaturesToTrack in JS)
  // So we'll use a simpler approach - scan the entire skeleton
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Skip background pixels
      if (data[idx] === 0) continue;
      
      // Get neighborhood
      const neighborhood = getNeighborhood(skelImageData, x, y);
      if (!neighborhood) continue;
      
      // Classify point
      const pointType = classifyPoint(neighborhood);
      
      // Add important points
      if (pointType !== 'none') {
        // Check if point is already close to an existing point
        const isDuplicate = importantPoints.some(p => 
          Math.abs(p.x - x) < minDistance && Math.abs(p.y - y) < minDistance
        );
        
        if (!isDuplicate) {
          importantPoints.push({ x, y, type: pointType });
        }
      }
    }
  }
  
  // Limit to maxCorners
  return importantPoints.slice(0, maxCorners);
}

/**
 * Cluster points using a simple K-means implementation
 * Similar to the Python cluster_points function
 * 
 * @param points Array of points to cluster
 * @param numClusters Number of clusters to form
 * @returns Array of cluster centers (points)
 */
export function clusterPoints(points: Point[], numClusters: number = 20): Point[] {
  if (points.length === 0) return [];
  
  // Use at most the number of points we have
  const k = Math.min(numClusters, points.length);
  
  // Initialize clusters with random points
  const clusters: Point[] = [];
  const usedIndices = new Set<number>();
  
  // Select k random points as initial cluster centers
  while (clusters.length < k) {
    const idx = Math.floor(Math.random() * points.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      clusters.push({ ...points[idx] });
    }
  }
  
  let changed = true;
  const MAX_ITERATIONS = 100;
  let iterations = 0;
  
  // Array to store cluster assignments for each point
  const assignments: number[] = new Array(points.length).fill(-1);
  
  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;
    
    // Assign points to nearest cluster
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      let minDist = Infinity;
      let minIdx = -1;
      
      for (let j = 0; j < clusters.length; j++) {
        const cluster = clusters[j];
        const dist = Math.sqrt(
          Math.pow(point.x - cluster.x, 2) + Math.pow(point.y - cluster.y, 2)
        );
        
        if (dist < minDist) {
          minDist = dist;
          minIdx = j;
        }
      }
      
      // Check if assignment changed
      if (assignments[i] !== minIdx) {
        assignments[i] = minIdx;
        changed = true;
      }
    }
    
    // Update cluster centers
    const sums: { x: number; y: number; count: number }[] = clusters.map(() => ({
      x: 0, y: 0, count: 0
    }));
    
    for (let i = 0; i < points.length; i++) {
      const clusterIdx = assignments[i];
      sums[clusterIdx].x += points[i].x;
      sums[clusterIdx].y += points[i].y;
      sums[clusterIdx].count++;
    }
    
    // Calculate new cluster centers
    for (let i = 0; i < clusters.length; i++) {
      if (sums[i].count > 0) {
        clusters[i].x = Math.round(sums[i].x / sums[i].count);
        clusters[i].y = Math.round(sums[i].y / sums[i].count);
      }
    }
  }
  
  return clusters;
}

/**
 * Color-code points on an image based on their type
 * Similar to fit_line_to_clustered_points in Python
 */
export function drawClusteredPoints(
  imageData: ImageData, 
  clusteredPoints: Point[], 
  draw: boolean = true
): void {
  if (!draw) return;
  
  const { width, height, data } = imageData;
  
  for (const point of clusteredPoints) {
    const { x, y } = point;
    
    // Check bounds
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    
    // Get neighborhood for classification
    const neighborhood = getNeighborhood(imageData, x, y);
    
    let color: [number, number, number]; // [R, G, B]
    
    if (!neighborhood) {
      color = [0, 165, 255]; // Orange
    } else {
      const pointType = classifyPoint(neighborhood);
      
      switch (pointType) {
        case 'endpoint':
          color = [255, 0, 0]; // Blue (BGR -> RGB)
          break;
        case 'corner':
          color = [0, 0, 255]; // Red
          break;
        case 't_junction':
          color = [0, 255, 0]; // Green
          break;
        default:
          color = [0, 165, 255]; // Orange
      }
    }
    
    // Draw a filled circle (approximation using a 3x3 square)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        const py = y + dy;
        
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        
        const idx = (py * width + px) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
      }
    }
  }
}