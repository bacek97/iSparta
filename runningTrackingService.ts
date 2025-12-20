/**
 * Running Tracking Service
 * Handles GPS location tracking, distance calculation, and pace monitoring
 */

import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

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
     * Request location permissions
     */
    async requestLocationPermission(): Promise<boolean> {
        if (Platform.OS === 'ios') {
            const auth = await Geolocation.requestAuthorization('whenInUse');
            return auth === 'granted';
        }

        if (Platform.OS === 'android') {
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
        }

        return false;
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

        this.watchId = Geolocation.watchPosition(
            (position) => {
                if (!this.session || this.session.isPaused) return;

                const point: GPSPoint = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    altitude: position.coords.altitude,
                    timestamp: position.timestamp,
                    accuracy: position.coords.accuracy,
                };

                // Only add point if accuracy is good enough (< 50m)
                if (point.accuracy < 50) {
                    this.session.route.push(point);
                    this.lastPoint = point;
                    this.updateMetrics();
                }
            },
            (error) => {
                console.error('[RunningTracking] Location error:', error);
            },
            {
                enableHighAccuracy: true,
                distanceFilter: 5, // Update every 5 meters
                interval: 3000,    // Update every 3 seconds
                fastestInterval: 2000,
            }
        );

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
        if (this.watchId !== null) {
            Geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

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
    isPaused(): boolean {
        return this.session !== null && this.session.isPaused;
    }
}

// Singleton instance
export const runningTracker = new RunningTrackingService();
