import { coordinatesToSvgPath, getRouteBounds, normalizeBounds, simplifyPath } from '../svgPathUtils';
import { GPSPoint } from '../runningTrackingService';

describe('SVG Path Utilities', () => {
    const mockRoute: GPSPoint[] = [
        { latitude: 10, longitude: 10, altitude: 0, timestamp: 0, accuracy: 0 },
        { latitude: 20, longitude: 20, altitude: 0, timestamp: 0, accuracy: 0 },
        { latitude: 30, longitude: 10, altitude: 0, timestamp: 0, accuracy: 0 },
    ];

    describe('coordinatesToSvgPath', () => {
        it('should return empty string for empty route', () => {
            expect(coordinatesToSvgPath([])).toBe('');
        });

        it('should return single move command for single point', () => {
            const singlePoint = [mockRoute[0]];
            // Should be normalized to 0,0 or center
            const path = coordinatesToSvgPath(singlePoint);
            expect(path).toMatch(/^M/);
        });

        it('should generate correct path commands for multiple points', () => {
            const path = coordinatesToSvgPath(mockRoute);
            // Should start with Move (M) and follow with Lines (L)
            expect(path.startsWith('M')).toBe(true);
            expect(path.split('L').length).toBe(3); // M + 2 Ls
        });
    });

    describe('getRouteBounds', () => {
        it('should return correct bounds for a route', () => {
            const bounds = getRouteBounds(mockRoute);
            expect(bounds).toEqual({
                minLat: 10,
                maxLat: 30,
                minLon: 10,
                maxLon: 20,
            });
        });

        it('should handle single point bounds', () => {
            const singlePoint = [mockRoute[0]];
            const bounds = getRouteBounds(singlePoint);
            expect(bounds).toEqual({
                minLat: 10,
                maxLat: 10,
                minLon: 10,
                maxLon: 10,
            });
        });
    });

    describe('normalizeBounds', () => {
        it('should normalize coordinates to fit viewBox', () => {
            const normalized = normalizeBounds(mockRoute, 100, 100);
            expect(normalized.length).toBe(3);

            // Check if all points are within 0-100 range
            normalized.forEach(p => {
                expect(p.x).toBeGreaterThanOrEqual(0);
                expect(p.x).toBeLessThanOrEqual(100);
                expect(p.y).toBeGreaterThanOrEqual(0);
                expect(p.y).toBeLessThanOrEqual(100);
            });
        });
    });

    describe('simplifyPath', () => {
        it('should reduce number of points for straight line', () => {
            const straightLine: GPSPoint[] = [
                { latitude: 0, longitude: 0, altitude: 0, timestamp: 0, accuracy: 0 },
                { latitude: 10, longitude: 10, altitude: 0, timestamp: 0, accuracy: 0 },
                { latitude: 20, longitude: 20, altitude: 0, timestamp: 0, accuracy: 0 },
            ];

            const simplified = simplifyPath(straightLine, 0.1);
            expect(simplified.length).toBeLessThan(straightLine.length);
            // Should keep start and end
            expect(simplified[0]).toEqual(straightLine[0]);
            expect(simplified[simplified.length - 1]).toEqual(straightLine[2]);
        });
    });
});
