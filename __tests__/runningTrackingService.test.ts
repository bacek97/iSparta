import { RunningTrackingService, GPSPoint } from '../runningTrackingService';
import * as SvgUtils from '../svgPathUtils';

// Mock Geolocation and Permissions
jest.mock('react-native-geolocation-service', () => ({
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
    requestAuthorization: jest.fn(),
}));

jest.mock('react-native', () => ({
    PermissionsAndroid: {
        request: jest.fn().mockResolvedValue('granted'),
        PERMISSIONS: {
            ACCESS_FINE_LOCATION: 'ACCESS_FINE_LOCATION',
        },
        RESULTS: {
            GRANTED: 'granted',
        },
    },
    Platform: {
        OS: 'android',
    },
}));

describe('RunningTrackingService', () => {
    let service: RunningTrackingService;

    beforeEach(() => {
        service = new RunningTrackingService();
    });

    it('should return empty SVG path when no session', () => {
        expect(service.getSvgPath()).toBe('');
    });

    it('should return empty bounds when no session', () => {
        expect(service.getBounds()).toBeNull();
    });

    it('should return empty route points when no session', () => {
        expect(service.getRoutePoints()).toEqual([]);
    });

    it('should generate SVG path from route', async () => {
        // Start tracking to initialize session
        await service.startTracking(() => { });

        // Manually inject points into session (since we mocked Geolocation)
        const session = service.getCurrentSession();
        if (session) {
            session.route = [
                { latitude: 0, longitude: 0, altitude: 0, timestamp: 1000, accuracy: 5 },
                { latitude: 10, longitude: 10, altitude: 0, timestamp: 2000, accuracy: 5 },
                { latitude: 20, longitude: 20, altitude: 0, timestamp: 3000, accuracy: 5 },
            ];
        }

        const svgPath = service.getSvgPath();
        expect(svgPath).toContain('M'); // Should contain Move command
        expect(svgPath).toContain('L'); // Should contain Line command
    });

    it('should return correct route points', async () => {
        await service.startTracking(() => { });
        const session = service.getCurrentSession();
        const points: GPSPoint[] = [
            { latitude: 0, longitude: 0, altitude: 0, timestamp: 1000, accuracy: 5 },
            { latitude: 10, longitude: 10, altitude: 0, timestamp: 2000, accuracy: 5 },
        ];
        if (session) {
            session.route = points;
        }

        expect(service.getRoutePoints()).toEqual(points);
    });

    it('should calculate correct bounds', async () => {
        await service.startTracking(() => { });
        const session = service.getCurrentSession();
        if (session) {
            session.route = [
                { latitude: 0, longitude: 0, altitude: 0, timestamp: 1000, accuracy: 5 },
                { latitude: 10, longitude: 10, altitude: 0, timestamp: 2000, accuracy: 5 },
            ];
        }

        const bounds = service.getBounds();
        expect(bounds).toEqual({
            minLat: 0,
            maxLat: 10,
            minLon: 0,
            maxLon: 10,
        });
    });
});
