/**
 * Type definitions for the Floorplan O1 processor
 */

/**
 * Represents a point in 2D space
 */
export type Point = { 
  x: number; 
  y: number;
  type?: PointType; 
};

/**
 * Represents a line segment between two points
 */
export type LineSegment = { 
  x1: number; 
  y1: number; 
  x2: number; 
  y2: number;
};

/**
 * Types of points based on their position in the floorplan
 */
export enum PointType {
  CORNER = 'corner',
  ENDPOINT = 'endpoint',
  T_JUNCTION = 't_junction',
  INTERSECTION = 'intersection',
  UNCLASSIFIED = 'unclassified'
}

/**
 * Result of the skeletonization process
 */
export interface SkeletonResult {
  skeleton: ImageData;
  originalWidth: number;
  originalHeight: number;
  debugInfo: {
    thresholdValue: number;
    algorithm: string;
  }
}

/**
 * Options for preprocessing and skeletonization
 */
export interface ProcessingOptions {
  threshold?: number;
  inverse?: boolean;
  maxIterations?: number;
}

/**
 * Options for corner and feature detection
 */
export interface DetectionOptions {
  minNeighbors?: number;
  minTransitions?: number;
}

/**
 * Options for line detection
 */
export interface LineDetectionOptions {
  threshold?: number;
  minLineLength?: number;
  maxLineGap?: number;
  maxDistance?: number;
}

/**
 * Options for clustering points
 */
export interface ClusterOptions {
  maxDistance?: number;
}