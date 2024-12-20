// packages/lib/mod.ts
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Example: A helper function for geometry calculations
export function calculateBoxVolume(width: number, height: number, depth: number): number {
  return width * height * depth;
}
