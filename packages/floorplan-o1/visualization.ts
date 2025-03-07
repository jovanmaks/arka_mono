/**
 * Visualization functions for drawing detected features on floorplan images
 */
import { Point, LineSegment } from "./types.ts";

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
  size: number = 3,
  color: [number, number, number] = [255, 0, 0]
): void {
  const halfSize = Math.floor(size / 2);
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
    setPixelColor(imageData, x, y, r, g, b);
    
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
  
  // Draw each corner point
  for (const corner of corners) {
    const color: [number, number, number] = [255, 0, 0]; // Red for corners
    drawPoint(result, corner, 3, color);
  }
  
  return result;
}

/**
 * Draws clustered points on the image.
 *
 * @param imageData - Image to draw on
 * @param clusters - Array of cluster points {x, y}
 * @param useOriginal - If true, modifies input imageData; otherwise makes a copy
 * @returns Modified image with clustered points highlighted
 */
export function drawClusteredPoints(
  imageData: ImageData, 
  clusters: Point[], 
  useOriginal: boolean = false
): ImageData {
  // Create a copy of the input image if needed
  const result = useOriginal ? 
    imageData : 
    new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  
  // Draw each cluster centroid
  for (const point of clusters) {
    const color: [number, number, number] = [0, 255, 0]; // Green for clusters
    drawPoint(result, point, 5, color);
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
      [0, 0, 255] // Blue for lines
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
  useOriginal: boolean = false
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
    // Draw intersections in purple
    for (const point of features.intersections) {
      drawPoint(result, point, 3, [255, 0, 255]);
    }
  }
  
  if (features.clusters) {
    drawClusteredPoints(result, features.clusters, true);
  }
  
  return result;
}