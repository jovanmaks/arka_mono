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
  count?: number; // For tracking cluster sizes
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
  includeTypes?: PointType[]; // Types of points to include in detection
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
  distanceThreshold?: number; // Maximum distance threshold for including points in clustering
  minClusterSize?: number;   // Minimum number of points in a cluster to be considered valid
  validateWalls?: boolean;   // Whether to validate that clusters are actually on walls
  preserveTypes?: boolean;   // Whether to group points by type before clustering
}