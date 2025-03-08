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
 * Enhanced version to better detect junctions and corners
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
      neighborhood[0][1] > 0 ? 1 : 0, // Top (P2)
      neighborhood[0][2] > 0 ? 1 : 0, // Top-right (P3)
      neighborhood[1][2] > 0 ? 1 : 0, // Right (P4)
      neighborhood[2][2] > 0 ? 1 : 0, // Bottom-right (P5)
      neighborhood[2][1] > 0 ? 1 : 0, // Bottom (P6)
      neighborhood[2][0] > 0 ? 1 : 0, // Bottom-left (P7)
      neighborhood[1][0] > 0 ? 1 : 0, // Left (P8)
      neighborhood[0][0] > 0 ? 1 : 0  // Top-left (P9)
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
      neighborhood[4 * 1 + 0] > 0 ? 1 : 0, // Top (P2)
      neighborhood[4 * 2 + 0] > 0 ? 1 : 0, // Top-right (P3)
      neighborhood[4 * 5 + 0] > 0 ? 1 : 0, // Right (P4)
      neighborhood[4 * 8 + 0] > 0 ? 1 : 0, // Bottom-right (P5)
      neighborhood[4 * 7 + 0] > 0 ? 1 : 0, // Bottom (P6)
      neighborhood[4 * 6 + 0] > 0 ? 1 : 0, // Bottom-left (P7)
      neighborhood[4 * 3 + 0] > 0 ? 1 : 0, // Left (P8)
      neighborhood[4 * 0 + 0] > 0 ? 1 : 0  // Top-left (P9)
    ];
  }
  
  // Count total foreground neighbors
  const neighbors = pattern.reduce((sum, val) => sum + val, 0);
  
  // Count transitions from 0 to 1
  let transitions = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === 0 && pattern[(i + 1) % pattern.length] === 1) {
      transitions++;
    }
  }

  // Extended connectivity analysis for junctions
  // Create a continuous pattern string for easier pattern matching
  const patternString = pattern.join('') + pattern[0]; // Add first element to end for circular pattern

  // Basic endpoint detection
  if (neighbors === 1) {
    return 'endpoint';
  }

  // Enhanced T-junction detection
  // A T-junction has 3 branches extending from it
  if (neighbors === 3) {
    // Check if branches form a T shape
    // We look for specific patterns that indicate T-junctions
    if (transitions === 2) {
      return 't_junction';
    }
    
    // Check for additional T-junction patterns that might be missed by the transition count
    // These are patterns where 3 branches extend from the center but don't perfectly match
    // the normal T-junction pattern
    
    // Pattern with 3 connected pixels where two form a line and one branches off
    const tPatterns = [
      '10001000', // ┬ pattern
      '01000100', // ┤ pattern
      '00100010', // ┴ pattern
      '00010001'  // ├ pattern
    ];

    if (tPatterns.some(p => patternString.includes(p))) {
      return 't_junction';
    }
  }

  // Enhanced corner detection
  // A corner has 2 branches extending from it at approximately 90 degrees
  if (neighbors === 2) {
    if (transitions === 2) {
      // Check if the two branches are adjacent for a real corner
      // Non-adjacent branches indicate a straight line segment, not a corner
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === 1 && pattern[(i + 1) % 8] === 1) {
          return 'none'; // Adjacent branches indicate a potential line segment
        }
      }

      // Two non-adjacent branches with transition count 2 is a corner
      return 'corner';
    }
    
    // Check for additional corner patterns
    // Look for two branches that are approximately 90° apart
    const cornerPatterns = [
      '10000100', // ┌ pattern
      '01000010', // ┐ pattern  
      '00100001', // └ pattern
      '00010001'  // ┘ pattern
    ];

    if (cornerPatterns.some(p => patternString.includes(p))) {
      return 'corner';
    }
  }

  // Handle complex junctions with 4 or more branches
  if (neighbors >= 4 && transitions >= 2) {
    return 't_junction'; // Treat as complex junction point
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
  maxCorners: number = 3000,
  qualityLevel: number = 0.001,
  minDistance: number = 3
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
        // More lenient duplicate checking - only check exact matches or very close points
        const isDuplicate = importantPoints.some(p => {
          const dx = Math.abs(p.x - x);
          const dy = Math.abs(p.y - y);
          // Points must be very close and of the same type to be considered duplicates
          return dx <= minDistance && dy <= minDistance && p.type === pointType;
        });
        
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
export function clusterPoints(points: Point[], numClusters: number = 50): Point[] {
  if (points.length === 0) return [];
  
  // Use at least 20 clusters but no more than half the points
  const k = Math.min(Math.max(numClusters, 20), Math.floor(points.length / 2));
  
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
  
  // Initialize sums array outside the loop so it's accessible for final filtering
  const sums: { x: number; y: number; count: number }[] = clusters.map(() => ({
    x: 0, y: 0, count: 0
  }));
  
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
        
        // Use a distance threshold to prevent points too far from being clustered
        if (dist < minDist && dist < 30) { // 30px max distance threshold
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
    
    // Reset sums for this iteration
    sums.forEach(sum => {
      sum.x = 0;
      sum.y = 0;
      sum.count = 0;
    });
    
    // Update cluster centers
    for (let i = 0; i < points.length; i++) {
      const clusterIdx = assignments[i];
      if (clusterIdx !== -1) { // Only count assigned points
        sums[clusterIdx].x += points[i].x;
        sums[clusterIdx].y += points[i].y;
        sums[clusterIdx].count++;
      }
    }
    
    // Calculate new cluster centers
    for (let i = 0; i < clusters.length; i++) {
      if (sums[i].count > 0) {
        clusters[i].x = Math.round(sums[i].x / sums[i].count);
        clusters[i].y = Math.round(sums[i].y / sums[i].count);
      }
    }
  }
  
  // Filter out empty clusters
  return clusters.filter((_, i) => sums[i].count > 0);
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