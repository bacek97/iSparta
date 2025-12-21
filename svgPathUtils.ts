import { GPSPoint } from './runningTrackingService';

export interface RouteBounds {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface Point {
    x: number;
    y: number;
}

/**
 * Calculate bounding box for a set of GPS points
 */
export function getRouteBounds(route: GPSPoint[]): RouteBounds {
    if (route.length === 0) {
        return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
    }

    let minLat = route[0].latitude;
    let maxLat = route[0].latitude;
    let minLon = route[0].longitude;
    let maxLon = route[0].longitude;

    for (const point of route) {
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLon = Math.min(minLon, point.longitude);
        maxLon = Math.max(maxLon, point.longitude);
    }

    return { minLat, maxLat, minLon, maxLon };
}

/**
 * Normalize GPS points to fit within a specific width/height (for SVG viewBox)
 * Preserves aspect ratio
 */
export function normalizeBounds(route: GPSPoint[], width: number = 100, height: number = 100): Point[] {
    if (route.length === 0) return [];

    const bounds = getRouteBounds(route);
    const latSpan = bounds.maxLat - bounds.minLat;
    const lonSpan = bounds.maxLon - bounds.minLon;

    if (latSpan === 0 && lonSpan === 0) {
        return [{ x: width / 2, y: height / 2 }];
    }

    // Determine scale to fit in box while preserving aspect ratio
    // Note: Latitude is Y, Longitude is X
    // In SVG, Y increases downwards, but Latitude increases upwards (North)
    // So we need to flip Y

    const padding = 5; // Padding in pixels
    const usableWidth = width - (padding * 2);
    const usableHeight = height - (padding * 2);

    const scaleX = lonSpan > 0 ? usableWidth / lonSpan : 0;
    const scaleY = latSpan > 0 ? usableHeight / latSpan : 0;

    // Use the smaller scale to fit both dimensions
    const scale = (scaleX > 0 && scaleY > 0) ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);

    return route.map(p => ({
        x: padding + (p.longitude - bounds.minLon) * scale,
        y: height - (padding + (p.latitude - bounds.minLat) * scale) // Flip Y
    }));
}

/**
 * Convert GPS route to SVG path string
 */
export function coordinatesToSvgPath(route: GPSPoint[], width: number = 100, height: number = 100): string {
    if (route.length === 0) return '';

    // Simplify path first to reduce size
    const simplified = simplifyPath(route, 0.0001); // Approx 11 meters tolerance
    const points = normalizeBounds(simplified, width, height);

    if (points.length === 0) return '';

    const start = points[0];
    let path = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`;

    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }

    return path;
}

/**
 * Douglas-Peucker simplification algorithm
 */
export function simplifyPath(points: GPSPoint[], tolerance: number): GPSPoint[] {
    if (points.length <= 2) return points;

    const sqTolerance = tolerance * tolerance;

    // Find the point with the maximum distance
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = getSqSegDist(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (dmax > sqTolerance) {
        const recResults1 = simplifyPath(points.slice(0, index + 1), tolerance);
        const recResults2 = simplifyPath(points.slice(index), tolerance);

        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [points[0], points[end]];
    }
}

// Square distance from a point to a segment
function getSqSegDist(p: GPSPoint, p1: GPSPoint, p2: GPSPoint): number {
    let x = p1.longitude;
    let y = p1.latitude;
    let dx = p2.longitude - x;
    let dy = p2.latitude - y;

    if (dx !== 0 || dy !== 0) {
        const t = ((p.longitude - x) * dx + (p.latitude - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
            x = p2.longitude;
            y = p2.latitude;
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p.longitude - x;
    dy = p.latitude - y;

    return dx * dx + dy * dy;
}
