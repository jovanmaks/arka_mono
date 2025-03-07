/**
 * Line intersection detection functions
 */
import { Point, LineSegment, PointType } from "./types.ts";

/**
 * Calculate intersection point of two lines (if any).
 * 
 * @param line1 - First line segment {x1, y1, x2, y2}
 * @param line2 - Second line segment {x1, y1, x2, y2}
 * @returns Point of intersection {x, y} or null if no intersection
 */
export function intersectLines(line1: LineSegment, line2: LineSegment): Point | null {
  // Represent line1 in parametric form: P1 + t*(P2-P1)
  const {x1, y1, x2, y2} = line1;
  const {x1: x3, y1: y3, x2: x4, y2: y4} = line2;
  
  // Compute denominator
  const denom = (x1 - x2)*(y3 - y4) - (y1 - y2)*(x3 - x4);
  if (Math.abs(denom) < 1e-6) {
    return null; // Lines are parallel or nearly parallel
  }
  
  // Intersection point
  const intersectX = ((x1*y2 - y1*x2)*(x3 - x4) - (x1 - x2)*(x3*y4 - y3*x4)) / denom;
  const intersectY = ((x1*y2 - y1*x2)*(y3 - y4) - (y1 - y2)*(x3*y4 - y3*x4)) / denom;
  
  // Check if intersection is within the line segments
  const between = (a: number, b: number, c: number): boolean => 
    (a >= Math.min(b, c) - 1e-6 && a <= Math.max(b, c) + 1e-6);
  
  if (
    between(intersectX, x1, x2) && between(intersectY, y1, y2) &&
    between(intersectX, x3, x4) && between(intersectY, y3, y4)
  ) {
    return { x: intersectX, y: intersectY };
  }
  
  return null;
}

/**
 * Find all intersection points between a set of detected lines
 * 
 * @param lines - Array of line segments {x1, y1, x2, y2}
 * @returns Array of intersection points {x, y}
 */
export function findIntersections(lines: LineSegment[]): Point[] {
  const intersections: Point[] = [];
  
  // Check all unique line pairs for intersections
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const intersection = intersectLines(lines[i], lines[j]);
      if (intersection) {
        // Mark this as an intersection point type
        intersection.type = PointType.INTERSECTION;
        intersections.push(intersection);
      }
    }
  }
  
  console.log(`[DEBUG] Found ${intersections.length} line intersections`);
  return intersections;
}

/**
 * Extract endpoints from lines as potential corner points
 * 
 * @param lines - Array of line segments
 * @returns Array of endpoint points
 */
export function extractEndpoints(lines: LineSegment[]): Point[] {
  const endpoints: Point[] = [];
  
  for (const line of lines) {
    // Add both endpoints of the line
    endpoints.push({ x: line.x1, y: line.y1, type: PointType.ENDPOINT });
    endpoints.push({ x: line.x2, y: line.y2, type: PointType.ENDPOINT }); // Fixed y2 coordinate
  }
  
  return endpoints;
}

/**
 * Combine all detected points: corners, intersections, and optionally endpoints
 * 
 * @param corners - Detected corner points
 * @param intersections - Line intersection points
 * @param endpoints - Optional line endpoints to include
 * @returns Combined array of points
 */
export function combineFeaturePoints(
  corners: Point[], 
  intersections: Point[], 
  endpoints: Point[] = []
): Point[] {
  return [...corners, ...intersections, ...endpoints];
}