/**
 * Visualization functions for drawing detected features on floorplan images
 */
import { Point, LineSegment, PointType } from "./types.ts";

/**
 * Helper function to set a pixel color in an ImageData
 */
function setPixelColor(
  imageData: ImageData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
): void {
  if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) return;
  const idx = (y * imageData.width + x) * 4;
  imageData.data[idx] = r;
  imageData.data[idx + 1] = g;
  imageData.data[idx + 2] = b;
}

/**
 * Draw a point with its neighborhood on the image
 */
function drawPoint(
  imageData: ImageData,
  point: Point,
  size: number = 6,  // Increased default size from 3 to 6
  color: [number, number, number] = [255, 0, 0],
  respectSize: boolean = true
): void {
  // Only adjust size if respectSize is true, otherwise use the provided size
  let adjustedSize = size;
  
  // Apply type-based size adjustment only when respectSize is true
  if (respectSize && point.type) {
    switch (point.type) {
      case PointType.T_JUNCTION:
      case PointType.INTERSECTION:
        adjustedSize = Math.max(size * 2, 12); // Increased from 6 to 12
        break;
      case PointType.ENDPOINT:
        adjustedSize = Math.max(size * 1.5, 8); // Increased from 4 to 8
        break;
      case PointType.CORNER:
        adjustedSize = Math.max(size * 1.5, 8); // Added specific size for corners
        break;
      // Other types use the default size
    }
  }

  const halfSize = Math.floor(adjustedSize / 2);
  for (let dy = -halfSize; dy <= halfSize; dy++) {
    for (let dx = -halfSize; dx <= halfSize; dx++) {
      // Make the center brighter
      const intensity = (dx === 0 && dy === 0) ? 255 : 180;
      const [r, g, b] = color.map(c => Math.min(255, (c * intensity) / 255));
      setPixelColor(imageData, point.x + dx, point.y + dy, r, g, b);
    }
  }
}

/**
 * Draw a line segment using Bresenham's algorithm
 */
function drawLine(
  imageData: ImageData,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number] = [0, 0, 255]
): void {
  const [r, g, b] = color;
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  
  let x = x1;
  let y = y1;
  
  while (true) {
    // Draw a 3x3 square for each line point to make the line thicker
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        setPixelColor(imageData, x + offsetX, y + offsetY, r, g, b);
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

/**
 * Get color for a specific point type
 * 
 * @param pointType - The type of point
 * @returns RGB color array
 */
function getPointTypeColor(pointType?: PointType): [number, number, number] {
  switch (pointType) {
    case PointType.CORNER:
      return [0, 0, 139]; // Dark blue for L-corners (was [255, 0, 0])
    case PointType.T_JUNCTION:
      return [0, 255, 0]; // Green for T junctions
    case PointType.ENDPOINT:
      return [173, 216, 230]; // Light blue for endpoints
    case PointType.INTERSECTION:
      return [255, 0, 255]; // Magenta for intersections
    case PointType.UNCLASSIFIED:
    default:
      return [255, 165, 0]; // Orange for unclassified/unknown
  }
}

/**
 * Draw annotation text next to a point
 * 
 * @param imageData - Image to draw on
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param label - Text label
 * @param color - Text color
 */
function drawLabel(
  imageData: ImageData,
  x: number,
  y: number,
  label: string,
  color: [number, number, number] = [255, 255, 255]
): void {
  // Simple implementation - just draw a bright pixel for now
  // In a real implementation, you'd need a font rendering system
  const [r, g, b] = color;
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      setPixelColor(imageData, x + dx, y + dy, r, g, b);
    }
  }
}

/**
 * Draws detected corners on an image.
 * 
 * @param imageData - Image to draw on
 * @param corners - Array of corner points {x, y}
 * @param useOriginal - If true, modifies input imageData; otherwise makes a copy
 * @returns Modified image with corners highlighted
 */
export function drawCorners(
  imageData: ImageData, 
  corners: Point[], 
  useOriginal: boolean = false
): ImageData {
  // Create a copy of the input image if needed
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  
  // Draw each corner point with consistent size
  for (const corner of corners) {
    const color: [number, number, number] = getPointTypeColor(corner.type);
    // Using fixed size=3 and respectSize=true for corners
    drawPoint(result, corner, 3, color, true);
  }
  
  return result;
}

/**
 * Draws clustered points on the image.
 *
 * @param imageData - Image to draw on
 * @param clusters - Array of cluster points {x, y}
 * @param useOriginal - If true, modifies input imageData; otherwise makes a copy
 * @param showLabels - If true, shows labels next to points
 * @returns Modified image with clustered points highlighted
 */
export function drawClusteredPoints(
  imageData: ImageData, 
  clusters: Point[], 
  useOriginal: boolean = false,
  showLabels: boolean = false
): ImageData {
  // Create a copy of the input image if needed
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  
  // Draw each cluster centroid with appropriate color based on type
  for (const point of clusters) {
    // Get color based on point type
    const color = getPointTypeColor(point.type);
    
    // Use larger size of 6 pixels (doubled from original 3)
    drawPoint(result, point, 6, color, true);  // Changed to use respectSize=true
    
    if (showLabels && point.type) {
      drawLabel(result, point.x + 8, point.y - 8, point.type);  // Adjusted label offset for larger points
    }
  }
  
  return result;
}

/**
 * Draws detected lines on the image.
 *
 * @param imageData - Image to draw on
 * @param lines - Array of line segments {x1, y1, x2, y2}
 * @param useOriginal - If true, modifies input imageData; otherwise makes a copy
 * @returns Modified image with lines highlighted
 */
export function drawLines(
  imageData: ImageData, 
  lines: LineSegment[], 
  useOriginal: boolean = false
): ImageData {
  // Create a copy of the input image if needed
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  
  // Draw each line
  for (const { x1, y1, x2, y2 } of lines) {
    drawLine(
      result, 
      Math.round(x1), 
      Math.round(y1), 
      Math.round(x2), 
      Math.round(y2),
      [255, 69, 0] // Light brown (rgb value for tan/beige color)
    );
  }
  
  return result;
}

/**
 * Draw all detected features on the image
 * 
 * @param imageData - Base image to draw on
 * @param features - Object containing all features to draw
 * @param useOriginal - Whether to modify input image or create copy
 * @param options - Additional options for visualization
 * @returns Modified image with all features drawn
 */
export function visualizeFeatures(
  imageData: ImageData,
  features: {
    corners?: Point[];
    clusters?: Point[];
    lines?: LineSegment[];
    intersections?: Point[];
  },
  useOriginal: boolean = false,
  options: { showLabels?: boolean } = {}
): ImageData {
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  
  // Draw features in order: lines, corners, intersections, clusters
  if (features.lines) {
    drawLines(result, features.lines, true);
  }
  
  if (features.corners) {
    drawCorners(result, features.corners, true);
  }
  
  if (features.intersections) {
    // Draw intersections
    for (const point of features.intersections) {
      drawPoint(result, point, 6, getPointTypeColor(PointType.INTERSECTION), true);
    }
  }
  
  if (features.clusters) {
    drawClusteredPoints(result, features.clusters, true, options.showLabels);
  }
  
  // Add a legend to help identify the colors
  const legendX = 10;
  let legendY = 10;
  const legendSpacing = 20;  // Increased spacing for larger points
  
  // Draw colored squares for each point type
  if (features.clusters && features.clusters.length > 0) {
    // Corner (L-junction)
    drawPoint(result, {x: legendX, y: legendY}, 6, getPointTypeColor(PointType.CORNER), true);
    drawLabel(result, legendX + 12, legendY, "Corner (L)", [255, 255, 255]);
    legendY += legendSpacing;
    
    // T-junction
    drawPoint(result, {x: legendX, y: legendY}, 6, getPointTypeColor(PointType.T_JUNCTION), true);
    drawLabel(result, legendX + 12, legendY, "T-Junction", [255, 255, 255]);
    legendY += legendSpacing;
    
    // Endpoint
    drawPoint(result, {x: legendX, y: legendY}, 6, getPointTypeColor(PointType.ENDPOINT), true);
    drawLabel(result, legendX + 12, legendY, "Endpoint", [255, 255, 255]);
    legendY += legendSpacing;
    
    // Intersection
    drawPoint(result, {x: legendX, y: legendY}, 6, getPointTypeColor(PointType.INTERSECTION), true);
    drawLabel(result, legendX + 12, legendY, "Intersection", [255, 255, 255]);
  }
  
  return result;
}