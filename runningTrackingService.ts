/**
 * Running Tracking Service
 * Handles GPS location tracking, distance calculation, and pace monitoring
 */

import BackgroundGeolocation from '@aakashsajjad/react-native-background-geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import * as SvgUtils from './svgPathUtils';

export interface GPSPoint {
    latitude: number;
    longitude: number;
    altitude: number | null;
    timestamp: number;
    accuracy: number;
}

export interface RunningMetrics {
    distance: number;        // in kilometers
    duration: number;        // in seconds
    currentPace: number;     // in min/km
    averagePace: number;     // in min/km
    currentSpeed: number;    // in km/h
    averageSpeed: number;    // in km/h
    calories: number;        // estimated calories burned
}

export interface RunningSession {
    sessionId: string;
    startTime: number;
    endTime: number | null;
    route: GPSPoint[];
    metrics: RunningMetrics;
    isPaused: boolean;
    pausedDuration: number;  // total paused time in seconds
}

export class RunningTrackingService {
    private watchId: number | null = null;
    private session: RunningSession | null = null;
    private lastPoint: GPSPoint | null = null;
    private startTimestamp: number = 0;
    private pauseStartTime: number = 0;
    private onMetricsUpdate: ((metrics: RunningMetrics) => void) | null = null;

    /**
     * Request location permissions (Android only, BackgroundGeolocation handles iOS)
     */
    async requestLocationPermission(): Promise<boolean> {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Location Permission',
                        message: 'iSparta needs access to your location for running tracking',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.error('Permission request error:', err);
                return false;
            }
        }

        // iOS - BackgroundGeolocation handles it automatically
        return true;
    }

    /**
     * Calculate distance between two GPS points using Haversine formula
     * Returns distance in kilometers
     */
    private calculateDistance(point1: GPSPoint, point2: GPSPoint): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(point2.latitude - point1.latitude);
        const dLon = this.toRad(point2.longitude - point1.longitude);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(point1.latitude)) *
            Math.cos(this.toRad(point2.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * Calculate total distance from route points
     */
    private getTotalDistance(route: GPSPoint[]): number {
        if (route.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 1; i < route.length; i++) {
            totalDistance += this.calculateDistance(route[i - 1], route[i]);
        }
        return totalDistance;
    }

    /**
     * Calculate pace in min/km
     */
    private calculatePace(distance: number, duration: number): number {
        if (distance === 0) return 0;
        return (duration / 60) / distance; // minutes per kilometer
    }

    /**
     * Calculate speed in km/h
     */
    private calculateSpeed(distance: number, duration: number): number {
        if (duration === 0) return 0;
        return (distance / duration) * 3600; // km per hour
    }

    /**
     * Estimate calories burned
     * Using MET (Metabolic Equivalent of Task) values
     * Assumes average weight of 70kg
     */
    private calculateCalories(distance: number, duration: number): number {
        const weight = 70; // kg (can be made configurable)
        const speed = this.calculateSpeed(distance, duration);

        // MET values based on running speed
        let met = 8; // default for moderate running
        if (speed < 6) met = 6;      // slow jogging
        else if (speed < 8) met = 8;  // moderate running
        else if (speed < 10) met = 10; // fast running
        else met = 12;                 // very fast running

        // Calories = MET * weight * duration(hours)
        return met * weight * (duration / 3600);
    }

    /**
     * Update metrics based on current session data
     */
    private updateMetrics(): void {
        if (!this.session) return;

        const route = this.session.route;
        const distance = this.getTotalDistance(route);
        const currentTime = Date.now();
        const duration = Math.floor((currentTime - this.startTimestamp - this.session.pausedDuration) / 1000);

        // Calculate current pace/speed from last 30 seconds of data
        const recentPoints = route.filter(p => p.timestamp > currentTime - 30000);
        const recentDistance = this.getTotalDistance(recentPoints);
        const recentDuration = recentPoints.length > 0
            ? (currentTime - recentPoints[0].timestamp) / 1000
            : 0;

        const currentPace = this.calculatePace(recentDistance, recentDuration);
        const currentSpeed = this.calculateSpeed(recentDistance, recentDuration);
        const averagePace = this.calculatePace(distance, duration);
        const averageSpeed = this.calculateSpeed(distance, duration);
        const calories = this.calculateCalories(distance, duration);

        this.session.metrics = {
            distance,
            duration,
            currentPace,
            averagePace,
            currentSpeed,
            averageSpeed,
            calories,
        };

        // Notify listeners
        if (this.onMetricsUpdate) {
            this.onMetricsUpdate(this.session.metrics);
        }
    }

    /**
     * Start tracking
     */
    async startTracking(onMetricsUpdate: (metrics: RunningMetrics) => void): Promise<boolean> {
        const hasPermission = await this.requestLocationPermission();
        if (!hasPermission) {
            console.error('[RunningTracking] Location permission denied');
            return false;
        }

        this.onMetricsUpdate = onMetricsUpdate;
        this.startTimestamp = Date.now();

        this.session = {
            sessionId: `run_${Date.now()}`,
            startTime: this.startTimestamp,
            endTime: null,
            route: [],
            metrics: {
                distance: 0,
                duration: 0,
                currentPace: 0,
                averagePace: 0,
                currentSpeed: 0,
                averageSpeed: 0,
                calories: 0,
            },
            isPaused: false,
            pausedDuration: 0,
        };

        // Configure BackgroundGeolocation
        BackgroundGeolocation.configure({
            desiredAccuracy: 0, // HIGH_ACCURACY
            stationaryRadius: 5,
            distanceFilter: 5,
            notificationTitle: 'iSparta Running',
            notificationText: 'Tracking your run',
            debug: false,
            startOnBoot: false,
            stopOnTerminate: true,
            locationProvider: 0, // DISTANCE_FILTER_PROVIDER (doesn't need ACTIVITY_RECOGNITION)
            interval: 3000,
            fastestInterval: 2000,
            activitiesInterval: 10000,
        });

        // Listen for location updates
        BackgroundGeolocation.on('location', (location) => {
            if (!this.session || this.session.isPaused) return;

            const point: GPSPoint = {
                latitude: location.latitude,
                longitude: location.longitude,
                altitude: location.altitude,
                timestamp: location.time,
                accuracy: location.accuracy,
            };

            // Only add point if accuracy is good enough (<50m)
            if (point.accuracy < 50) {
                this.session.route.push(point);
                this.lastPoint = point;
                this.updateMetrics();
            }
        });

        BackgroundGeolocation.on('error', (error) => {
            console.error('[RunningTracking] Location error:', error);
        });

        // Start tracking
        BackgroundGeolocation.start();

        return true;
    }

    /**
     * Pause tracking
     */
    pauseTracking(): void {
        if (this.session && !this.session.isPaused) {
            this.session.isPaused = true;
            this.pauseStartTime = Date.now();
        }
    }

    /**
     * Resume tracking
     */
    resumeTracking(): void {
        if (this.session && this.session.isPaused) {
            this.session.isPaused = false;
            const pauseDuration = Date.now() - this.pauseStartTime;
            this.session.pausedDuration += pauseDuration;
        }
    }

    /**
     * Stop tracking and return final session
     */
    stopTracking(): RunningSession | null {
        // Stop BackgroundGeolocation
        BackgroundGeolocation.stop();
        BackgroundGeolocation.removeAllListeners();

        if (this.session) {
            this.session.endTime = Date.now();
            this.updateMetrics();
            const finalSession = this.session;
            this.session = null;
            this.lastPoint = null;
            this.onMetricsUpdate = null;
            return finalSession;
        }

        return null;
    }

    /**
     * Get current session
     */
    getCurrentSession(): RunningSession | null {
        return this.session;
    }

    /**
     * Check if tracking is active
     */
    isTracking(): boolean {
        return this.session !== null && !this.session.isPaused;
    }

    /**
     * Check if session is paused
     */
    /**
     * Check if session is paused
     */
    isPaused(): boolean {
        return this.session !== null && this.session.isPaused;
    }

    /**
     * Get SVG path for current route
     */
    getSvgPath(): string {
        if (!this.session || this.session.route.length < 2) return '';
        return SvgUtils.coordinatesToSvgPath(this.session.route);
    }

    /**
     * Get raw route points
     */
    getRoutePoints(): GPSPoint[] {
        return this.session ? this.session.route : [];
    }

    /**
     * Get route bounds
     */
    getBounds(): SvgUtils.RouteBounds | null {
        if (!this.session || this.session.route.length === 0) return null;
        return SvgUtils.getRouteBounds(this.session.route);
    }
}

// Singleton instance
export const runningTracker = new RunningTrackingService();
