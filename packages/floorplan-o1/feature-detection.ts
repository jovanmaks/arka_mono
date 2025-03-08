/**
 * Feature detection functions for the floorplan processor
 */
import { Point, DetectionOptions, LineDetectionOptions, ClusterOptions, LineSegment, PointType } from "./types.ts";

/**
 * Classifies a point based on its neighborhood pattern
 * Enhanced to better detect junctions, corners and endpoints
 * 
 * @param neighborhood A 3x3 array of pixel values (0 or 255)
 * @returns The point type
 */
export function classifyJunctionType(neighborhood: number[]): PointType {
  // Count total foreground neighbors
  const neighbors = neighborhood.reduce((sum, val) => sum + val, 0);
  
  // Count transitions from 0 to 1
  let transitions = 0;
  for (let i = 0; i < neighborhood.length; i++) {
    if (neighborhood[i] === 0 && neighborhood[(i + 1) % neighborhood.length] === 1) {
      transitions++;
    }
  }
  
  // Create a continuous pattern string for easier pattern matching
  const patternString = neighborhood.join('') + neighborhood[0]; // Add first element to end for circular pattern
  
  // Basic endpoint detection
  if (neighbors === 1) {
    return PointType.ENDPOINT;
  }
  
  // Enhanced corner detection (L-junction)
  if (neighbors === 2) {
    if (transitions === 2) {
      // Check if the two branches are adjacent for a real corner
      // Non-adjacent branches indicate a straight line segment, not a corner
      for (let i = 0; i < neighborhood.length; i++) {
        if (neighborhood[i] === 1 && neighborhood[(i + 1) % 8] === 1) {
          return PointType.UNCLASSIFIED; // Adjacent branches indicate a potential line segment
        }
      }
      // Two non-adjacent branches with transition count 2 is a corner
      return PointType.CORNER;
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
      return PointType.CORNER;
    }
  }
  
  // Enhanced T-junction detection
  if (neighbors === 3) {
    if (transitions === 2) {
      return PointType.T_JUNCTION;
    }
    
    // Check for additional T-junction patterns
    const tPatterns = [
      '10001000', // ┬ pattern
      '01000100', // ┤ pattern
      '00100010', // ┴ pattern
      '00010001'  // ├ pattern
    ];
    if (tPatterns.some(p => patternString.includes(p))) {
      return PointType.T_JUNCTION;
    }
  }
  
  // Handle complex junctions with 4 or more branches
  if (neighbors >= 4 && transitions >= 2) {
    return PointType.INTERSECTION; 
  }
  
  return PointType.UNCLASSIFIED;
}

/**
 * Extract a 3x3 neighborhood from ImageData at position (x,y)
 */
function getNeighborhood(imageData: ImageData, x: number, y: number): number[] {
  const { width, height, data } = imageData;
  
  // Check bounds
  if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) {
    return [];
  }
  
  // Extract 3x3 neighborhood as binary values (0 or 1)
  const neighborhood: number[] = [];
  
  // Top-left to bottom-right in clockwise order, excluding center
  const offsets = [
    [-1, -1], [0, -1], [1, -1], [1, 0],
    [1, 1], [0, 1], [-1, 1], [-1, 0]
  ];
  
  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    const idx = (ny * width + nx) * 4;
    neighborhood.push(data[idx] > 0 ? 1 : 0);
  }
  
  return neighborhood;
}

/**
 * Detects corner points and other junctions in a binary image using advanced pattern recognition.
 * 
 * @param imageData - Skeletonized binary image
 * @param options - Detection options
 * @returns Array of detected junction points {x, y, type}
 */
export function detectCorners(
  imageData: ImageData, 
  options: DetectionOptions = {}
): Point[] {
  const { width, height, data } = imageData;
  const corners: Point[] = [];
  
  // Default parameter values
  const minNeighbors = options.minNeighbors ?? 1; // Lower this to catch more points
  const minTransitions = options.minTransitions ?? 1; // Lower this to catch more points
  const includeTypes = options.includeTypes ?? [
    PointType.CORNER, 
    PointType.T_JUNCTION, 
    PointType.ENDPOINT, 
    PointType.INTERSECTION
  ];
  
  // Scan the image for all foreground pixels
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Skip background pixels
      if (data[idx] === 0) continue;
      
      // Get neighborhood
      const neighborhood = getNeighborhood(imageData, x, y);
      if (neighborhood.length === 0) continue;
      
      // Count foreground neighbors
      const neighborCount = neighborhood.reduce((sum, val) => sum + val, 0);
      if (neighborCount < minNeighbors) continue;
      
      // Count transitions
      let transitions = 0;
      for (let i = 0; i < neighborhood.length; i++) {
        if (neighborhood[i] === 0 && neighborhood[(i + 1) % 8] === 1) {
          transitions++;
        }
      }
      if (transitions < minTransitions) continue;
      
      // Classify the junction type
      const pointType = classifyJunctionType(neighborhood);
      
      // Add point if it's of a requested type
      if (includeTypes.includes(pointType)) {
        corners.push({ x, y, type: pointType });
      }
    }
  }
  
  console.log(`[DEBUG] Detected ${corners.length} corner candidates`);
  return corners;
}

/**
 * Clusters nearby points into a single point using distance-based clustering.
 * Enhanced version with type-aware clustering to improve junction detection.
 * 
 * @param points - Array of points {x, y, type}
 * @param options - Clustering options
 * @returns Array of clustered points (centroids)
 */
export function clusterPoints(
  points: Point[], 
  options: ClusterOptions = {}
): Point[] {
  if (points.length === 0) return [];

  const maxDistance = options.maxDistance ?? 10;
  const distanceThreshold = options.distanceThreshold ?? 30; // Max distance threshold
  const minClusterSize = options.minClusterSize ?? 1; // Default to 1 to keep all clusters
  const preserveTypes = options.preserveTypes ?? true; // Whether to prioritize junction types
  
  // Group points by type first if preserveTypes is enabled
  const pointsByType: Record<string, Point[]> = {};
  
  if (preserveTypes) {
    // Group by type
    for (const point of points) {
      const type = point.type || PointType.UNCLASSIFIED;
      if (!pointsByType[type]) {
        pointsByType[type] = [];
      }
      pointsByType[type].push(point);
    }
  } else {
    // Just one group with all points
    pointsByType['all'] = points;
  }
  
  // Process each type group separately
  const allClusters: Point[] = [];
  
  for (const type in pointsByType) {
    const typePoints = pointsByType[type];
    
    // Create clusters initially containing one point each
    let clusters: (Point[] | null)[] = typePoints.map(point => [point]);
    let mergeOccurred = true;
    
    // Iteratively merge clusters until no more merges occur
    while (mergeOccurred) {
      mergeOccurred = false;
      
      for (let i = 0; i < clusters.length; i++) {
        if (!clusters[i]) continue; // Skip already merged clusters
        
        for (let j = i + 1; j < clusters.length; j++) {
          if (!clusters[j]) continue; // Skip already merged clusters
          
          // Check distance between clusters
          const canMerge = clusters[i]!.some(p1 => 
            clusters[j]!.some(p2 => {
              const dx = p1.x - p2.x;
              const dy = p1.y - p2.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              // Only merge if within the merge distance threshold
              return dist <= maxDistance;
            })
          );
          
          // Merge clusters if they're close enough
          if (canMerge) {
            clusters[i] = clusters[i]!.concat(clusters[j]!);
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
    const typeClusters = clusters
      .filter(cluster => cluster!.length >= minClusterSize)
      .map(cluster => {
        const sumX = cluster!.reduce((sum, p) => sum + p.x, 0);
        const sumY = cluster!.reduce((sum, p) => sum + p.y, 0);
        
        // Determine the most common point type in this cluster
        const typeCounts: Record<string, number> = {};
        for (const point of cluster!) {
          const pointType = point.type || PointType.UNCLASSIFIED;
          typeCounts[pointType] = (typeCounts[pointType] || 0) + 1;
        }
        
        // Find the most frequent type
        let mostCommonType = PointType.UNCLASSIFIED;
        let maxCount = 0;
        for (const type in typeCounts) {
          if (typeCounts[type] > maxCount) {
            maxCount = typeCounts[type];
            mostCommonType = type as PointType;
          }
        }
        
        return {
          x: Math.round(sumX / cluster!.length),
          y: Math.round(sumY / cluster!.length),
          type: mostCommonType as PointType,
          count: cluster!.length  // Keep track of cluster size
        };
      });
    
    allClusters.push(...typeClusters);
  }
  
  console.log(`[DEBUG] Clustered into ${allClusters.length} points`);
  return allClusters;
}

/**
 * Detects straight line segments in the skeleton image using a simplified Hough transform approach.
 * 
 * @param imageData - Binary image data
 * @param options - Line detection options
 * @returns Array of detected line segments { x1, y1, x2, y2 }
 */
export function detectStraightLines(
  imageData: ImageData,
  options: LineDetectionOptions = {}
): LineSegment[] {
  const { width, height, data } = imageData;
  const lines: LineSegment[] = [];
  
  // Default parameter values
  const threshold = options.threshold ?? 30;
  const minLineLength = options.minLineLength ?? 20;
  const maxLineGap = options.maxLineGap ?? 5;
  const maxDistance = options.maxDistance ?? 5;
  
  // Extract foreground pixel coordinates
  const points: Point[] = [];
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
  
  // Group points by potential lines
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    
    for (let angleIdx = 0; angleIdx < 180; angleIdx++) {
      const theta = angleIdx * angleStep;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      // Find points that lie on this angle from p1
      const potentialLinePoints: Point[] = [];
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
  const filteredLines: LineSegment[] = [];
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