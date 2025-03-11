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
  
  // Enhanced endpoint detection - more permissive to catch more endpoints
  if (neighbors === 1 || (neighbors === 2 && transitions >= 2)) {
    // Basic endpoint case: only one neighbor
    if (neighbors === 1) {
      return PointType.ENDPOINT;
    }
    
    // Special case for endpoints with 2 neighbors that might be part of thin lines
    // Check if they're adjacent which would suggest it's part of a thin line end
    for (let i = 0; i < neighborhood.length; i++) {
      if (neighborhood[i] === 1 && neighborhood[(i + 1) % 8] === 1) {
        return PointType.ENDPOINT;
      }
    }
  }
  
  // Enhanced corner detection (L-junction) - MORE RESTRICTIVE
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
      // Only check specific L-corner patterns (90-degree angles)
      const exactCornerPatterns = [
        [1, 0, 0, 0, 0, 1, 0, 0], // ┌ pattern (North-East)
        [0, 1, 0, 0, 0, 0, 1, 0], // ┐ pattern (East-South)
        [0, 0, 1, 0, 0, 0, 0, 1], // └ pattern (South-West)
        [0, 0, 0, 1, 1, 0, 0, 0]  // ┘ pattern (West-North)
      ];
      
      // Check if the neighborhood matches any of these exact patterns
      const matchesExactPattern = exactCornerPatterns.some(pattern => {
        for (let i = 0; i < 8; i++) {
          if (pattern[i] !== neighborhood[i]) {
            return false;
          }
        }
        return true;
      });
      
      if (matchesExactPattern) {
        return PointType.CORNER;
      }
      
      return PointType.UNCLASSIFIED; // Not a recognized corner pattern
    }
    
    // Check for specific corner patterns - STRICT MATCHING
    // Look for two branches that are exactly 90° apart
    const cornerPatterns = [
      '10000100', // ┌ pattern (North-East)
      '01000010', // ┐ pattern (East-South)
      '00100001', // └ pattern (South-West)
      '00010001'  // ┘ pattern (West-North)
    ];
    
    // Only exact matches, not substring matches
    if (cornerPatterns.includes(neighborhood.join(''))) {
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
 * Enhanced to better preserve endpoint detection.
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
  const endpointMap = new Map<string, Point>(); // Track endpoints by position
  
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
      
      // For endpoints, we're more lenient with minimum neighbors
      const pointType = classifyJunctionType(neighborhood);
      
      // Special handling for endpoints
      if (pointType === PointType.ENDPOINT) {
        if (includeTypes.includes(PointType.ENDPOINT)) {
          const key = `${x},${y}`;
          endpointMap.set(key, { x, y, type: PointType.ENDPOINT });
        }
        continue; // Skip other checks for endpoints
      }
      
      // For non-endpoints, apply standard filtering
      if (neighborCount < minNeighbors) continue;
      
      // Count transitions
      let transitions = 0;
      for (let i = 0; i < neighborhood.length; i++) {
        if (neighborhood[i] === 0 && neighborhood[(i + 1) % 8] === 1) {
          transitions++;
        }
      }
      if (transitions < minTransitions) continue;
      
      // Add point if it's of a requested type
      if (includeTypes.includes(pointType)) {
        corners.push({ x, y, type: pointType });
      }
    }
  }
  
  // Add all detected endpoints to the corners array
  corners.push(...endpointMap.values());
  
  console.log(`[DEBUG] Detected ${corners.length} corner candidates (including endpoints: ${endpointMap.size})`);
  return corners;
}

/**
 * Clusters nearby points into a single point using distance-based clustering.
 * Enhanced version with aggressive merging to handle noise in the floorplan.
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

  // Configuration parameters with more aggressive defaults
  const maxDistance = options.maxDistance ?? 20;  // Increased from 10
  const distanceThreshold = options.distanceThreshold ?? 30; 
  const minClusterSize = options.minClusterSize ?? 1;
  const preserveTypes = options.preserveTypes ?? false; // Force false to ensure merging different types

  console.log(`[DEBUG] Clustering with maxDistance=${maxDistance}, preserveTypes=${preserveTypes}`);
  
  // STEP 1: First pass - aggressively merge very close points regardless of type
  // This handles the case where we have multiple points very close to each other
  // representing the same physical corner but classified as different junction types
  const tightRadius = Math.max(8, maxDistance / 2); // Increased from 5 to 8
  
  console.log(`[DEBUG] Initial tight clustering with radius=${tightRadius}`);
  
  // Build a distance matrix for quick lookup
  const distMatrix: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      distMatrix[i][j] = Math.sqrt(dx*dx + dy*dy);
    }
  }
  
  // Initial clustering - assign each point to a cluster
  const initialClusters: number[][] = [];
  const assignedPoints = new Set<number>();
  
  for (let i = 0; i < points.length; i++) {
    if (assignedPoints.has(i)) continue;
    
    const cluster: number[] = [i];
    assignedPoints.add(i);
    
    for (let j = 0; j < points.length; j++) {
      if (i === j || assignedPoints.has(j)) continue;
      
      if (distMatrix[i][j] <= tightRadius) {
        cluster.push(j);
        assignedPoints.add(j);
      }
    }
    
    initialClusters.push(cluster);
  }
  
  console.log(`[DEBUG] Initial clustering: ${initialClusters.length} clusters from ${points.length} points`);
  
  // STEP 2: Second pass - merge the initial clusters if they're close enough
  // Only apply type-based preservation if explicitly requested
  let finalClusters: (Point[] | null)[] = [];
  
  if (preserveTypes) {
    // Group initial clusters by type first
    const pointsByType: Record<string, Point[]> = {};
    
    for (const cluster of initialClusters) {
      // Determine the dominant type in this cluster
      const typeCounts: Record<string, number> = {};
      
      for (const idx of cluster) {
        const pointType = points[idx].type || PointType.UNCLASSIFIED;
        typeCounts[pointType] = (typeCounts[pointType] || 0) + 1;
      }
      
      // Find the most frequent type
      let dominantType = PointType.UNCLASSIFIED;
      let maxCount = 0;
      for (const type in typeCounts) {
        if (typeCounts[type] > maxCount) {
          maxCount = typeCounts[type];
          dominantType = type as PointType;
        }
      }
      
      // Create the point cluster with the average position
      const clusterPoints = cluster.map(idx => points[idx]);
      
      if (!pointsByType[dominantType]) {
        pointsByType[dominantType] = [];
      }
      pointsByType[dominantType].push(...clusterPoints);
    }
    
    // Process each type separately
    for (const type in pointsByType) {
      const typePoints = pointsByType[type];
      
      // Create clusters for this type
      finalClusters.push(...typePoints.map(p => [p]));
    }
  } else {
    // Don't preserve types - just create clusters from the initial groupings
    finalClusters = initialClusters.map(cluster => cluster.map(idx => points[idx]));
  }
  
  // STEP 3: Merge clusters based on distance - iterative process
  let mergeOccurred = true;
  let iterationCount = 0;
  const maxIterations = 10; // Prevent infinite loops
  
  while (mergeOccurred && iterationCount < maxIterations) {
    mergeOccurred = false;
    iterationCount++;
    
    for (let i = 0; i < finalClusters.length; i++) {
      if (!finalClusters[i]) continue; // Skip already merged clusters
      
      for (let j = i + 1; j < finalClusters.length; j++) {
        if (!finalClusters[j]) continue; // Skip already merged clusters
        
        // Check if any points in the clusters are close enough to merge
        const canMerge = finalClusters[i]!.some(p1 => 
          finalClusters[j]!.some(p2 => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            return dist <= maxDistance;
          })
        );
        
        // Merge clusters if they're close enough
        if (canMerge) {
          finalClusters[i] = finalClusters[i]!.concat(finalClusters[j]!);
          finalClusters[j] = null; // Mark as merged
          mergeOccurred = true;
        }
      }
    }
    
    // Filter out null clusters
    if (mergeOccurred) {
      finalClusters = finalClusters.filter(cluster => cluster !== null);
      console.log(`[DEBUG] Clustering iteration ${iterationCount}: ${finalClusters.length} clusters remaining`);
    }
  }
  
  // STEP 4: Calculate centroids for each cluster
  const resultClusters = finalClusters
    .filter(cluster => cluster!.length >= minClusterSize)
    .map(cluster => {
      const sumX = cluster!.reduce((sum, p) => sum + p.x, 0);
      const sumY = cluster!.reduce((sum, p) => sum + p.y, 0);
      
      // Determine type priority
      // T-junctions and intersections are more important than corners,
      // which are more important than endpoints for wall reconstruction
      const typePriority: Record<string, number> = {
        [PointType.INTERSECTION]: 4,
        [PointType.T_JUNCTION]: 3,
        [PointType.CORNER]: 2,
        [PointType.ENDPOINT]: 1,
        [PointType.UNCLASSIFIED]: 0
      };
      
      // Count point types and select by priority
      const typeCounts: Record<string, number> = {};
      for (const point of cluster!) {
        const pointType = point.type || PointType.UNCLASSIFIED;
        typeCounts[pointType] = (typeCounts[pointType] || 0) + 1;
      }
      
      // Find highest priority type that appears at least once
      let bestType = PointType.UNCLASSIFIED;
      let highestPriority = -1;
      
      for (const type in typeCounts) {
        const priority = typePriority[type] || 0;
        if (priority > highestPriority && typeCounts[type] > 0) {
          highestPriority = priority;
          bestType = type as PointType;
        }
      }
      
      return {
        x: Math.round(sumX / cluster!.length),
        y: Math.round(sumY / cluster!.length),
        type: bestType,
        count: cluster!.length  // Keep track of cluster size
      };
    });
  
  // Log cluster results  
  const typeCounts: Record<string, number> = {};
  for (const point of resultClusters) {
    const type = point.type || PointType.UNCLASSIFIED;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }
  
  console.log(`[DEBUG] Final result: Clustered ${points.length} points into ${resultClusters.length} points`);
  console.log(`[DEBUG] Point types after clustering:`);
  console.log(`Endpoints: ${typeCounts[PointType.ENDPOINT] || 0}`);
  console.log(`T-Junctions: ${typeCounts[PointType.T_JUNCTION] || 0}`);
  console.log(`Corners: ${typeCounts[PointType.CORNER] || 0}`);
  console.log(`Intersections: ${typeCounts[PointType.INTERSECTION] || 0}`);
  console.log(`Unclassified: ${typeCounts[PointType.UNCLASSIFIED] || 0}`);
  
  return resultClusters;
}

/**
 * Creates line segments by connecting junctions and endpoints.
 * This approach uses junction information rather than a Hough transform.
 * 
 * @param imageData - Binary image data
 * @param points - Array of junction and endpoint points to connect
 * @param options - Line connection options
 * @returns Array of detected line segments { x1, y1, x2, y2 }
 */
export function connectJunctionsToLines(
  imageData: ImageData,
  points: Point[],
  options: LineDetectionOptions = {}
): LineSegment[] {
  if (points.length < 2) {
    return [];
  }

  const { width, height, data } = imageData;
  const lines: LineSegment[] = [];
  
  // Default parameter values
  const maxLineGap = options.maxLineGap ?? 5;
  const maxConnectionDistance = options.maxDistance ?? 100; // Maximum distance to search for connections
  
  // Create a function to check if a line between two points is valid
  // by checking that it follows the foreground pixels in the image
  const isLineValid = (p1: Point, p2: Point): boolean => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Skip very long connections
    if (distance > maxConnectionDistance) {
      return false;
    }
    
    // Sample points along the line to check if they follow the foreground path
    const steps = Math.max(10, Math.floor(distance / 2));
    let foregroundCount = 0;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(p1.x + dx * t);
      const y = Math.round(p1.y + dy * t);
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        if (data[idx] > 0) {
          foregroundCount++;
        }
      }
    }
    
    // Line is valid if at least 70% of points are on foreground pixels
    // For very short lines, we'll use a higher percentage
    const minRequiredPercentage = distance < 20 ? 0.9 : 0.7;
    return foregroundCount / steps >= minRequiredPercentage;
  };
  
  // For each point, try to connect to all other points and check if the connection is valid
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    
    for (let j = i + 1; j < points.length; j++) {
      const p2 = points[j];
      
      // Check if this is a valid connection
      if (isLineValid(p1, p2)) {
        lines.push({
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y
        });
      }
    }
  }
  
  // Filter duplicate or nearly identical lines
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
  
  console.log(`[DEBUG] Created ${filteredLines.length} wall lines by connecting junctions`);
  return filteredLines;
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