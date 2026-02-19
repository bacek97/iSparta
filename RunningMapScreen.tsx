import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { MapView, Camera, ShapeSource, LineLayer, CircleLayer, RasterSource, RasterLayer } from '@maplibre/maplibre-react-native';
import BackgroundGeolocation from '@aakashsajjad/react-native-background-geolocation';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { runningTracker, RunningMetrics, GPSPoint } from './runningTrackingService';
import * as SportsGrounds from './sportsGroundsService';
import * as SvgUtils from './svgPathUtils';

// Set MapLibre Access Token (if needed, or use a free style)
// MapLibreGL.setAccessToken(null);

type RunningMapScreenRouteProp = RouteProp<{
    RunningMap: {
        mode: 'TRACKING' | 'VIEWING';
        routePoints?: GPSPoint[];
        routeBounds?: SvgUtils.RouteBounds;
    };
}, 'RunningMap'>;

export default function RunningMapScreen() {
    const navigation = useNavigation();
    const route = useRoute<RunningMapScreenRouteProp>();
    const { mode, routePoints, routeBounds } = route.params || { mode: 'TRACKING' };

    const [metrics, setMetrics] = useState<RunningMetrics>({
        distance: 0, duration: 0, currentPace: 0, averagePace: 0, currentSpeed: 0, averageSpeed: 0, calories: 0
    });
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<number[] | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<number[][]>([]);
    const [sportsGrounds, setSportsGrounds] = useState<SportsGrounds.SportsGround[]>([]);

    const mapRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const lastFetchCenter = useRef<{ lat: number; lon: number } | null>(null);
    const stepCountingEnabled = useRef<boolean>(false);

    // Handler for map region change - fetch sports grounds for new visible area
    const handleRegionDidChange = async (feature: any) => {
        if (mode !== 'TRACKING') return;

        try {
            const center = feature?.geometry?.coordinates;
            if (!center || center.length < 2) return;

            const lon = center[0];
            const lat = center[1];

            // Avoid refetching if moved less than ~500m
            if (lastFetchCenter.current) {
                const distLat = Math.abs(lat - lastFetchCenter.current.lat);
                const distLon = Math.abs(lon - lastFetchCenter.current.lon);
                // ~0.005 degrees ≈ 500m
                if (distLat < 0.005 && distLon < 0.005) {
                    return;
                }
            }

            lastFetchCenter.current = { lat, lon };
            console.log('[DEBUG] Map region changed, fetching sports grounds for:', lat, lon);
            const grounds = await SportsGrounds.fetchNearbySportsGrounds(lat, lon);
            console.log('[DEBUG] Fetched', grounds.length, 'sports grounds for new area');
            setSportsGrounds(grounds);
        } catch (error) {
            console.error('[DEBUG] Failed to fetch sports grounds on region change:', error);
        }
    };

    // Initialize Map
    useEffect(() => {
        if (mode === 'VIEWING' && routeBounds) {
            // Fit bounds for viewing mode
            setTimeout(() => {
                cameraRef.current?.fitBounds(
                    [routeBounds.minLon, routeBounds.minLat], // SouthWest
                    [routeBounds.maxLon, routeBounds.maxLat], // NorthEast
                    50 // padding
                );
            }, 500);

            if (routePoints) {
                setRouteCoordinates(routePoints.map(p => [p.longitude, p.latitude]));
            }
        } else if (mode === 'TRACKING') {
            // Setup tracking
            setupTracking();
            fetchSportsGrounds();
        }

        return () => {
            if (mode === 'TRACKING') {
                // Cleanup if needed, but usually we want tracking to continue in background
                // runningTracker.stopTracking(); // Only stop if user explicitly stops
            }
        };
    }, [mode]);

    const setupTracking = async () => {
        // Check if already tracking
        if (runningTracker.isTracking()) {
            setIsTracking(true);
            setIsPaused(runningTracker.isPaused());
            const session = runningTracker.getCurrentSession();
            if (session) {
                setRouteCoordinates(session.route.map(p => [p.longitude, p.latitude]));
                setMetrics(session.metrics);
            }
        }
    };

    const fetchSportsGrounds = async () => {
        // Fetch grounds near current location (mock location for now or use last known)
        // In a real app, we'd update this as user moves
        try {
            // Default to Berlin for demo if no location
            const lat = currentLocation ? currentLocation[1] : 52.52;
            const lon = currentLocation ? currentLocation[0] : 13.405;
            console.log('[DEBUG] Fetching sports grounds for:', lat, lon);
            const grounds = await SportsGrounds.fetchNearbySportsGrounds(lat, lon);
            console.log('[DEBUG] Fetched', grounds.length, 'sports grounds');
            console.log('[DEBUG] First ground:', grounds[0]);
            setSportsGrounds(grounds);
        } catch (error) {
            console.error('[DEBUG] Failed to fetch sports grounds:', error);
        }
    };

    const handleStart = async () => {
        console.log('[DEBUG] Start button pressed');
        Alert.alert('Test', 'Start button works! Now testing location...');

        try {
            console.log('[DEBUG] Requesting location permission...');
            const hasPermission = await runningTracker.requestLocationPermission();
            console.log('[DEBUG] Permission result:', hasPermission);

            if (!hasPermission) {
                Alert.alert('Permission Denied', 'Location permission is required');
                return;
            }

            // Request step counting permission (optional - running works without it)
            const { requestActivityRecognitionPermission } = await import('./stepCounterService');
            const hasStepPermission = await requestActivityRecognitionPermission();
            stepCountingEnabled.current = hasStepPermission;

            if (!hasStepPermission) {
                console.log('[DEBUG] Step counting permission denied, steps will be saved as 0');
            }

            Alert.alert('Permission OK', 'Location permission granted, starting tracker...');

            const started = await runningTracker.startTracking((newMetrics) => {
                console.log('[DEBUG] Metrics updated:', newMetrics);
                setMetrics(newMetrics);
                const session = runningTracker.getCurrentSession();
                if (session && session.route.length > 0) {
                    const lastPoint = session.route[session.route.length - 1];
                    setCurrentLocation([lastPoint.longitude, lastPoint.latitude]);
                    setRouteCoordinates(session.route.map(p => [p.longitude, p.latitude]));

                    // Center map on user
                    cameraRef.current?.setCamera({
                        centerCoordinate: [lastPoint.longitude, lastPoint.latitude],
                        zoomLevel: 15,
                        animationDuration: 1000,
                    });
                }
            });

            console.log('[DEBUG] Running tracker started:', started);

            if (started) {
                setIsTracking(true);
                setIsPaused(false);
                console.log('[DEBUG] Tracking started successfully');
                Alert.alert('Success', 'Tracking started!');
            } else {
                console.log('[DEBUG] Running tracker failed to start');
                Alert.alert('Error', 'Failed to start tracking');
            }
        } catch (error) {
            console.error('[DEBUG] handleStart error:', error);
            Alert.alert('Start Error', `Error: ${error}`);
        }
    };

    const handlePause = () => {
        runningTracker.pauseTracking();
        setIsPaused(true);
    };

    const handleResume = () => {
        runningTracker.resumeTracking();
        setIsPaused(false);
    };

    const handleStop = () => {
        Alert.alert(
            'Stop Run',
            'Are you sure you want to stop tracking?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Stop',
                    style: 'destructive',
                    onPress: async () => {
                        const session = runningTracker.stopTracking();
                        setIsTracking(false);
                        setIsPaused(false);

                        if (session) {
                            try {
                                console.log('[DEBUG] Saving running session...', session.metrics);

                                // Import dependencies
                                const { convertRunningToWorkout, kilometersToSteps } = await import('./runningSessionConverter');
                                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                                const { getTodaySteps, saveSteps } = await import('./stepCounterService');

                                // Convert to workout format
                                const workoutSession = convertRunningToWorkout(session);
                                console.log('[DEBUG] Converted to workout:', workoutSession);

                                // Save to AsyncStorage (same pattern as ProfileScreen)
                                const key = `session_${workoutSession.sessionId}`;
                                await AsyncStorage.setItem(key, JSON.stringify(workoutSession));
                                console.log('[DEBUG] Saved to storage:', key);

                                // Update steps - only if permission was granted
                                let runningSteps = 0;
                                if (stepCountingEnabled.current) {
                                    runningSteps = kilometersToSteps(session.metrics.distance);
                                    const currentSteps = await getTodaySteps();
                                    const newTotalSteps = currentSteps + runningSteps;
                                    await saveSteps(newTotalSteps);
                                    console.log('[DEBUG] Updated step counter:', currentSteps, '+', runningSteps, '=', newTotalSteps);
                                } else {
                                    console.log('[DEBUG] Step counting disabled, saving 0 steps');
                                }

                                // Earn time for App Lock feature
                                try {
                                    const { earnTime } = await import('./timeBankService');
                                    const { TimeEarningSource } = await import('./appLockTypes');

                                    const distanceKm = session.metrics.distance;
                                    let totalEarned = 0;

                                    // Earn time from running (1 km = 1 min)
                                    if (distanceKm > 0) {
                                        await earnTime(TimeEarningSource.RUNNING, distanceKm);
                                        totalEarned += Math.floor(distanceKm);
                                    }

                                    // Earn time from steps (100 steps = 1 min)
                                    if (runningSteps > 0) {
                                        await earnTime(TimeEarningSource.STEPS, runningSteps);
                                        totalEarned += Math.floor(runningSteps / 100);
                                    }

                                    if (totalEarned > 0) {
                                        console.log(`[RunningMapScreen] Earned ${totalEarned} minutes for App Lock`);
                                    }
                                } catch (earnError) {
                                    console.log('Time earning skipped:', earnError);
                                }

                                Alert.alert(
                                    'Run Saved',
                                    `Distance: ${session.metrics.distance.toFixed(2)} km\nSteps: ${runningSteps}\nDuration: ${Math.floor(session.metrics.duration / 60)} min`,
                                );
                                navigation.goBack();
                            } catch (error) {
                                console.error('[DEBUG] Failed to save run:', error);
                                Alert.alert('Error', `Failed to save running session: ${error}`);
                            }
                        }
                    }
                }
            ]
        );
    };

    const onMarkerPress = (ground: SportsGrounds.SportsGround) => {
        Alert.alert(
            'Sports Ground',
            'Open in browser?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open', onPress: () => Linking.openURL(ground.url) }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                mapStyle={{
                    version: 8,
                    sources: {},
                    layers: []
                }}
                onRegionDidChange={handleRegionDidChange}
            >
                {/* OSM Tiles */}
                <RasterSource
                    id="osm"
                    tileUrlTemplates={['https://tile.openstreetmap.org/{z}/{x}/{y}.png']}
                    tileSize={256}
                >
                    <RasterLayer id="osm-layer" />
                </RasterSource>

                <Camera
                    ref={cameraRef}
                    defaultSettings={{
                        centerCoordinate: [13.405, 52.52], // Default Berlin
                        zoomLevel: 12,
                    }}
                />

                {/* Route Line */}
                {routeCoordinates.length > 1 && (
                    <ShapeSource id="routeSource" shape={{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: routeCoordinates,
                        },
                        properties: {},
                    }}>
                        <LineLayer
                            id="routeLine"
                            style={{
                                lineColor: '#007AFF',
                                lineWidth: 4,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                    </ShapeSource>
                )}

                {/* Current Location Marker (Tracking Mode) */}
                {mode === 'TRACKING' && currentLocation && (
                    <ShapeSource id="userLocationSource" shape={{
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: currentLocation,
                        },
                        properties: {},
                    }}>
                        <CircleLayer
                            id="userLocationCircle"
                            style={{
                                circleRadius: 8,
                                circleColor: '#007AFF',
                                circleStrokeColor: '#FFFFFF',
                                circleStrokeWidth: 2,
                            }}
                        />
                    </ShapeSource>
                )}

                {/* Sports Grounds Markers */}
                {sportsGrounds.map((ground, index) => {
                    console.log(`[DEBUG] Rendering marker ${index}:`, ground.id || 'NO_ID', ground.title);
                    return (
                        <ShapeSource
                            key={ground.id || `ground-${index}`}
                            id={`ground-source-${ground.id || index}`}
                            shape={{
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: [ground.longitude, ground.latitude],
                                },
                                properties: {
                                    title: ground.title,
                                },
                            }}
                            onPress={() => {
                                console.log('[DEBUG] Marker selected:', ground.title);
                                onMarkerPress(ground);
                            }}
                        >
                            <CircleLayer
                                id={`ground-circle-${ground.id || index}`}
                                style={{
                                    circleRadius: 6,
                                    circleColor: '#FF9500',
                                    circleStrokeColor: '#FFFFFF',
                                    circleStrokeWidth: 2,
                                }}
                            />
                        </ShapeSource>
                    );
                })}
            </MapView>

            {/* Overlay UI */}
            <View style={styles.overlay}>
                {mode === 'TRACKING' && (
                    <View style={styles.statsContainer}>
                        <Text style={styles.statText}>Dist: {metrics.distance.toFixed(2)} km</Text>
                        <Text style={styles.statText}>Time: {formatDuration(metrics.duration)}</Text>
                        <Text style={styles.statText}>Pace: {metrics.currentPace.toFixed(2)} min/km</Text>
                    </View>
                )}

                {mode === 'TRACKING' && (
                    <View style={styles.controlsContainer}>
                        {!isTracking ? (
                            <TouchableOpacity style={[styles.button, styles.startButton]} onPress={handleStart}>
                                <Text style={styles.buttonText}>Start</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                {isPaused ? (
                                    <TouchableOpacity style={[styles.button, styles.resumeButton]} onPress={handleResume}>
                                        <Text style={styles.buttonText}>Resume</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={[styles.button, styles.pauseButton]} onPress={handlePause}>
                                        <Text style={styles.buttonText}>Pause</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={handleStop}>
                                    <Text style={styles.buttonText}>Stop</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

function formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    button: {
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 30,
        minWidth: 100,
        alignItems: 'center',
    },
    startButton: {
        backgroundColor: '#4CAF50',
    },
    pauseButton: {
        backgroundColor: '#FFC107',
    },
    resumeButton: {
        backgroundColor: '#2196F3',
    },
    stopButton: {
        backgroundColor: '#F44336',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userMarker: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#2196F3',
        borderWidth: 3,
        borderColor: 'white',
    },
    groundMarker: {
        width: 15,
        height: 15,
        borderRadius: 7.5,
        backgroundColor: '#FF9800',
        borderWidth: 2,
        borderColor: 'white',
    },
});
