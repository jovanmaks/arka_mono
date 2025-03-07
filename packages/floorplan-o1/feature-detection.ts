/**
 * Feature detection functions for the floorplan processor
 */
import { Point, DetectionOptions, LineDetectionOptions, ClusterOptions, LineSegment } from "./types.ts";

/**
 * Detects corner points in a binary image using pattern recognition.
 * This is an implementation specifically optimized for detecting wall intersections in floorplans.
 * 
 * @param imageData - Skeletonized binary image
 * @param options - Detection options
 * @returns Array of detected corner points {x, y}
 */
export function detectCorners(
  imageData: ImageData, 
  options: DetectionOptions = {}
): Point[] {
  const { width, height, data } = imageData;
  const corners: Point[] = [];

  // Default parameter values
  const minNeighbors = options.minNeighbors ?? 3;
  const minTransitions = options.minTransitions ?? 2;

  // Helper function to check if a pixel is a corner candidate
  const isCornerCandidate = (x: number, y: number): boolean => {
    if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) return false;
    
    // Check if this is a foreground pixel
    const idx = (y * width + x) * 4;
    if (data[idx] === 0) return false;
    
    // Count neighbors (in 3x3 window)
    let neighborCount = 0;
    let transitions = 0;
    const neighborVals: number[] = [];

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

    // A corner should have sufficient foreground neighbors
    // and enough transitions (for T-junction or X-crossing)
    return neighborCount >= minNeighbors && transitions >= minTransitions;
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
 * @param points - Array of points {x, y}
 * @param options - Clustering options
 * @returns Array of clustered points (centroids)
 */
export function clusterPoints(
  points: Point[], 
  options: ClusterOptions = {}
): Point[] {
  if (points.length === 0) return [];

  const maxDistance = options.maxDistance ?? 10;

  // Create clusters initially containing one point each
  let clusters: (Point[] | null)[] = points.map(point => [point]);
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
            return Math.sqrt(dx*dx + dy*dy) <= maxDistance;
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
  return clusters.map(cluster => {
    const sumX = cluster!.reduce((sum, p) => sum + p.x, 0);
    const sumY = cluster!.reduce((sum, p) => sum + p.y, 0);
    return { 
      x: Math.round(sumX / cluster!.length), 
      y: Math.round(sumY / cluster!.length) 
    };
  });
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