import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
} from 'react-native';
import Svg, { Path, Ellipse, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISE_NAMES, EXERCISES } from './common_types';
import { SimpleWorkoutSession, SimpleExerciseRecord } from './exerciseTrackingService';
import WeeklyStreakCalendar from './WeeklyStreakCalendar';
import { getTodaySteps, subscribeToSteps, startStepCounter, getStepsForDate } from './stepCounterService';
import { getVirtualDate } from './testingUtils';
import { filterSessionsByDate, getRunningKilometersForDate } from './profileHelpers';
import { getAutoSyncEnabled } from './autoSyncService';
import { getUserAllSessions, ServerWorkoutSession } from './statsService';
import { getCurrentUser } from './authService';
import { PublicationCreator } from './components/PublicationCreator';

// Optional navigation import - don't crash if not available
let useNavigation: (() => any) | null = null;
try {
    useNavigation = require('@react-navigation/native').useNavigation;
} catch (e) {
    console.log('Navigation not available');
}

interface ProfileScreenProps {
    onNavigateToHome?: () => void;
    onNavigateToLeaderboard?: () => void;
}

interface SessionDisplay {
    id: string;
    date: Date;
    totalDurationSeconds: number;
    exercises: Array<{
        exerciseName: EXERCISES;
        reps?: number;
        durationSeconds: number;
    }>;
}

const screenWidth = Dimensions.get('window').width;

// Exercise Map SVG Component (moved from MapScreen)
const ExerciseMapSvg = ({ scale }: { scale: number }) => {
    const baseWidth = screenWidth - 50;
    const baseHeight = (baseWidth / 483.563) * 88.246;
    const svgWidth = baseWidth * scale;
    const svgHeight = baseHeight * scale;

    return (
        <Svg width={svgWidth} height={svgHeight} viewBox="0 0 483.563 88.246" preserveAspectRatio="xMidYMid meet">
            {/* Main pink connection path to advanced exercises */}
            <Path d="M288.333 18.867c.34-.8 1.124-1.322 1.904-1.646.294-.121.602-.204.902-.306 2.218-.595 4.543-.56 6.81-.306.49.055.978.14 1.467.21 1.48.235 2.94.623 4.3 1.266.264.125 1.03.556.78.405-.766-.456-1.548-.883-2.32-1.325 2.032 1.265 4.084 2.501 6.21 3.61.637.334 2.06.702 2.683.882 3.955.97 7.974 1.648 11.996 2.272 2.833.404 5.661.834 8.505 1.15 1.281.077 2.556.29 3.84.321 1.082.026 2.158-.079 3.228-.212l.784-.122-2.973-2.078-.71.155c-.81.128-1.055.188-1.905.226-1.655.074-3.308-.14-4.952-.291-2.765-.335-5.53-.677-8.296-1.007-4.05-.567-8.113-1.178-12.035-2.364-.547-.19-1.102-.36-1.64-.57-.426-.164-1.606-.84-1.25-.553.632.515 1.405.83 2.106 1.25.264.157-.533-.306-.796-.465-.242-.148-.479-.304-.719-.456l-.738-.466c-.592-.34-3.162-1.949-4.584-2.555-1.319-.562-2.729-.858-4.146-1.037-1.134-.129-1.862-.227-3.016-.287a30 30 0 0 0-3.11.004 15 15 0 0 0-1.389.125c-.348.054-.686.163-1.03.245-.336.099-.68.176-1.009.298-.897.332-1.735.893-2.3 1.67z" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />

            {/* Connection lines for arms (orange) */}
            <Path d="M59.745 42.116c1.78-1.225 4.187-1.542 6.403-1.748 1.888-.138 3.115-.076 4.716.783.353.147.947.423 1.34.47 1.6.19 3.545-.344 5.092-.657 1.64-.376 3.202-.869 4.366-1.944l-3.959-2.037c-1.093 1-2.608 1.435-4.126 1.802-1.595.319-3.352.777-4.997.429-.356-.076-.978-.377-1.306-.526-1.61-.707-3.03-.716-4.82-.537-2.337.273-4.818.648-6.703 1.933z" fill="#ff8a00" fillOpacity="1" strokeWidth=".0574055" />
            <Path d="M105.427 35.292a7 7 0 0 1 2.515-1.222c1.224-.251 2.48-.249 3.724-.265 1.956-.097 3.897.162 5.832.41 2.026.322 4.042.76 5.952 1.517.455.206 1.116.496 1.558.733.222.12.873.51.652.387-4.635-2.58-2.706-1.616-1.404-.548 1.274 1.15 2.595 2.248 3.823 3.447a106 106 0 0 1 3.263 3.424 81 81 0 0 0 3.32 3.612 22 22 0 0 0 2.976 2.457c1.788 1.242 3.64 2.43 5.62 3.335.47.163.233.093.707.213l-3.125-2.413c-.446-.154-.225-.067-.664-.261-1.21-.633-3.149-1.759 2.321 1.382.13.075-.255-.16-.378-.245-.135-.094-.265-.196-.397-.294l-.435-.295c-1.102-.668-2.083-1.53-3.039-2.39-1.149-1.164-2.272-2.35-3.327-3.6a111 111 0 0 0-3.245-3.439c-1.224-1.214-2.555-2.305-3.82-3.476-2.173-1.92-4.81-3.257-7.45-4.415-1.934-.69-3.94-1.134-5.973-1.42-1.965-.252-3.933-.497-5.92-.405-1.273.019-2.563.018-3.806.333a8.8 8.8 0 0 0-2.635 1.33z" fill="#ff8a00" fillOpacity="1" strokeWidth=".0529167" />

            {/* All exercise ellipses with labels */}
            <Ellipse cx="32.679" cy="54.725" rx="32.653" ry="27.963" fill="#202020" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="32.679" y="57" fontSize="4" fill="#fff" textAnchor="middle">ОТЖИМАНИЯ</SvgText>

            <Ellipse cx="102.5" cy="64.625" rx="18.063" ry="11.463" fill="#16b139" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="102.5" y="66" fontSize="3.5" fill="#fff" textAnchor="middle">ПРИСЕДАНИЯ</SvgText>

            <Ellipse cx="163.163" cy="75.186" rx="19.232" ry="11.897" fill="#16b139" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="163.163" y="77" fontSize="3.5" fill="#fff" textAnchor="middle">ВЫПАДЫ</SvgText>

            <Ellipse cx="212.963" cy="73.136" rx="15.284" ry="9.553" fill="#16b139" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="212.963" y="74.5" fontSize="3" fill="#fff" textAnchor="middle">JUMPING JACK</SvgText>

            <Ellipse cx="163.463" cy="21.552" rx="19.626" ry="10.768" fill="#ff8a00" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="163.463" y="20" fontSize="3" fill="#fff" textAnchor="middle">СГИБАНИЕ РУК</SvgText>
            <SvgText x="163.463" y="24" fontSize="3" fill="#fff" textAnchor="middle">НА ТРИЦЕПС</SvgText>

            <Ellipse cx="270.279" cy="15.125" rx="19.8" ry="12.332" fill="#ff8a00" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="270.279" y="14" fontSize="3" fill="#fff" textAnchor="middle">СГИБАНИЕ РУК</SvgText>
            <SvgText x="270.279" y="18" fontSize="3" fill="#fff" textAnchor="middle">НА БИЦЕПС</SvgText>

            <Ellipse cx="92.947" cy="36.141" rx="15.458" ry="10.768" fill="#ff8a00" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />

            <Ellipse cx="229.116" cy="43.61" rx="23.1" ry="15.111" fill="#770072" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="229.116" y="42" fontSize="3" fill="#fff" textAnchor="middle">ЖИМ ГАНТЕЛЕЙ</SvgText>
            <SvgText x="229.116" y="46" fontSize="3" fill="#fff" textAnchor="middle">НА ПЛЕЧИ</SvgText>

            <Ellipse cx="281.742" cy="43.61" rx="21.189" ry="11.637" fill="#770072" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="281.742" y="45" fontSize="3" fill="#fff" textAnchor="middle">ТЯГА ГАНТЕЛЕЙ</SvgText>

            <Ellipse cx="279.831" cy="68.62" rx="21.363" ry="11.289" fill="#770072" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="279.831" y="67" fontSize="2.8" fill="#fff" textAnchor="middle">ПОДЪЁМ ГАНТЕЛЕЙ</SvgText>
            <SvgText x="279.831" y="71" fontSize="2.8" fill="#fff" textAnchor="middle">В СТОРОНЫ</SvgText>

            <Ellipse cx="154.952" cy="49.341" rx="19.105" ry="9.726" fill="#0026cd" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="154.952" y="51" fontSize="3" fill="#fff" textAnchor="middle">ПОДЪЁМ КОРПУСА</SvgText>

            <Ellipse cx="360.942" cy="19.641" rx="30.221" ry="15.111" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="360.942" y="21" fontSize="3.5" fill="#fff" textAnchor="middle">ПОДТЯГИВАНИЯ</SvgText>

            <Ellipse cx="355.384" cy="75.741" rx="21.189" ry="12.505" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="355.384" y="74" fontSize="3" fill="#fff" textAnchor="middle">ПОДЪЁМ НА ТУРНИК</SvgText>
            <SvgText x="355.384" y="78" fontSize="3" fill="#fff" textAnchor="middle">С ПЕРЕВОРОТОМ</SvgText>

            <Ellipse cx="421.384" cy="52.12" rx="30.221" ry="15.979" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="421.384" y="51" fontSize="3.5" fill="#fff" textAnchor="middle">ОТЖИМАНИЯ</SvgText>
            <SvgText x="421.384" y="55" fontSize="3.5" fill="#fff" textAnchor="middle">НА БРУСЬЯХ</SvgText>

            <Ellipse cx="453.689" cy="14.952" rx="29.874" ry="13.547" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="453.689" y="16" fontSize="3.5" fill="#fff" textAnchor="middle">ВЫХОД АНГЕЛА</SvgText>

            {/* Lock icons for locked exercises */}
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(12.316 28.51)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(69.684 13.467)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(265.688 48.4)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(277.15 -7.179)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(337.593 25.821)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(370.94 -12.042)" />
        </Svg>
    );
};

function ProfileScreen({ onNavigateToHome, onNavigateToLeaderboard }: ProfileScreenProps = {}) {
    // Try to get navigation from context, but don't crash if not available
    let navigation: any = null;
    try {
        if (useNavigation) {
            navigation = useNavigation();
        }
    } catch (e) {
        // Navigation context not available - that's okay
    }

    const [recentSessions, setRecentSessions] = useState<SessionDisplay[]>([]);
    const [allSessions, setAllSessions] = useState<SimpleWorkoutSession[]>([]);
    const [totalWorkouts, setTotalWorkouts] = useState<number>(0);
    const [totalReps, setTotalReps] = useState<number>(0);
    const [totalMinutes, setTotalMinutes] = useState<number>(0);
    const [todaySteps, setTodaySteps] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedDateSteps, setSelectedDateSteps] = useState<number>(0);
    const [selectedDateKm, setSelectedDateKm] = useState<number>(0);
    const [publishingSession, setPublishingSession] = useState<SimpleWorkoutSession | null>(null);
    const [currentUserKey, setCurrentUserKey] = useState<string>('');
    const [mapScale, setMapScale] = useState(1.5);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load SimpleWorkoutSession data from AsyncStorage
            const keys = await AsyncStorage.getAllKeys();
            const sessionKeys = keys.filter(key => key.startsWith('session_'));

            const localSessions: SimpleWorkoutSession[] = [];
            for (const key of sessionKeys) {
                const sessionData = await AsyncStorage.getItem(key);
                if (sessionData) {
                    localSessions.push(JSON.parse(sessionData));
                }
            }

            let sessions: SimpleWorkoutSession[] = [...localSessions];

            // Check if auto-sync is enabled - if so, fetch from server
            const autoSyncEnabled = await getAutoSyncEnabled();
            if (autoSyncEnabled) {
                try {
                    const user = await getCurrentUser();
                    if (user?.publicKey) {
                        console.log('[ProfileScreen] Auto-sync enabled, fetching from server...');
                        const serverSessions = await getUserAllSessions(user.publicKey);
                        console.log('[ProfileScreen] Got', serverSessions.length, 'sessions from server');

                        // Process server sessions - extract steps and save separately
                        for (const serverSession of serverSessions) {
                            for (const set of serverSession.exercise_sets) {
                                // If this is a STEPS exercise, save to steps storage
                                if (set.exercise_type === 'STEPS' && set.reps) {
                                    const sessionDate = new Date(serverSession.session_date);
                                    const dateStr = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-${String(sessionDate.getDate()).padStart(2, '0')}`;
                                    const stepsKey = `@iSparta:steps_${dateStr}`;

                                    // Check if we already have steps for this date
                                    const existingSteps = await AsyncStorage.getItem(stepsKey);
                                    const existingValue = existingSteps ? parseInt(existingSteps, 10) : 0;

                                    // Only update if server has more steps
                                    if (set.reps > existingValue) {
                                        await AsyncStorage.setItem(stepsKey, set.reps.toString());
                                        console.log('[ProfileScreen] Saved steps from server:', set.reps, 'for date:', dateStr);
                                    }
                                }
                            }
                        }

                        // Convert server sessions to local format (excluding pure STEPS sessions)
                        const convertedServerSessions: SimpleWorkoutSession[] = serverSessions
                            .filter(serverSession => {
                                // Filter out sessions that ONLY contain STEPS exercises
                                const nonStepsExercises = serverSession.exercise_sets.filter(
                                    set => set.exercise_type !== 'STEPS'
                                );
                                return nonStepsExercises.length > 0;
                            })
                            .map((serverSession: ServerWorkoutSession) => {
                                // Create exercises record from server exercise sets
                                const exercises: Record<EXERCISES, SimpleExerciseRecord> =
                                    Object.values(EXERCISES).reduce((acc, ex) => {
                                        acc[ex] = { duration: 0, reps: undefined };
                                        return acc;
                                    }, {} as Record<EXERCISES, SimpleExerciseRecord>);

                                // Populate from server data (skip STEPS - handled separately)
                                serverSession.exercise_sets.forEach(set => {
                                    if (set.exercise_type === 'STEPS') return; // Skip STEPS

                                    const exerciseType = set.exercise_type as EXERCISES;
                                    if (exercises[exerciseType]) {
                                        exercises[exerciseType] = {
                                            duration: set.seconds || 0,
                                            reps: set.reps || undefined,
                                        };
                                    }
                                });

                                return {
                                    sessionId: serverSession.signature,
                                    startTime: new Date(serverSession.session_date),
                                    exercises,
                                };
                            });

                        // Merge: use Map to avoid duplicates (server data takes priority)
                        const sessionMap = new Map<string, SimpleWorkoutSession>();

                        // Add local sessions first
                        localSessions.forEach(s => sessionMap.set(s.sessionId, s));

                        // Server sessions override local (they have confirmed data)
                        convertedServerSessions.forEach(s => sessionMap.set(s.sessionId, s));

                        sessions = Array.from(sessionMap.values());
                        console.log('[ProfileScreen] Merged to', sessions.length, 'unique sessions');
                    }
                } catch (serverError) {
                    console.warn('[ProfileScreen] Failed to fetch from server, using local only:', serverError);
                    // Continue with local sessions only
                }
            }

            // Convert SimpleWorkoutSession to SessionDisplay format
            const displaySessions: SessionDisplay[] = sessions.map(session => {
                const exercises: Array<{
                    exerciseName: EXERCISES;
                    reps?: number;
                    durationSeconds: number;
                }> = [];

                // Extract exercises with non-zero activity
                Object.entries(session.exercises).forEach(([exerciseName, record]) => {
                    if (record.duration > 0 || (record.reps && record.reps > 0)) {
                        exercises.push({
                            exerciseName: exerciseName as EXERCISES,
                            reps: record.reps,
                            durationSeconds: record.duration
                        });
                    }
                });

                const totalDuration = Object.values(session.exercises).reduce(
                    (sum, ex) => sum + ex.duration, 0
                );

                return {
                    id: session.sessionId,
                    date: new Date(session.startTime),
                    totalDurationSeconds: totalDuration,
                    exercises
                };
            });

            // Sort by date and take last 10
            const recent = displaySessions
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 10);
            setRecentSessions(recent);
            setAllSessions(sessions);

            // Calculate totals
            setTotalWorkouts(sessions.length);
            const totalRepsCount = displaySessions.reduce((sum, session) => {
                return sum + session.exercises.reduce((exSum, ex) => exSum + (ex.reps || 0), 0);
            }, 0);
            setTotalReps(totalRepsCount);

            const totalSeconds = displaySessions.reduce((sum, session) => sum + session.totalDurationSeconds, 0);
            setTotalMinutes(Math.floor(totalSeconds / 60));

            // Load today's steps
            const steps = await getTodaySteps();
            setTodaySteps(steps);

            console.log('[ProfileScreen] Loaded', sessions.length, 'sessions (local + server)');
        } catch (error) {
            console.error('[ProfileScreen] Error loading data:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setLoading(false);
        }
    };

    // Subscribe to step counter updates
    useEffect(() => {
        console.log('[ProfileScreen] Starting step counter subscription');

        // Start step counter and set initial value
        startStepCounter().then((initialSteps) => {
            console.log('[ProfileScreen] Initial steps:', initialSteps);
            setTodaySteps(initialSteps);
        });

        const unsubscribe = subscribeToSteps((steps) => {
            console.log('[ProfileScreen] Steps updated:', steps);
            setTodaySteps(steps);
        });

        // Load current user for publications
        getCurrentUser().then(user => {
            if (user?.publicKey) {
                setCurrentUserKey(user.publicKey);
            }
        });

        return () => {
            console.log('[ProfileScreen] Unsubscribing from step counter');
            unsubscribe();
        };
    }, []);

    // Initialize selectedDate from virtual date - also reload on focus
    useEffect(() => {
        const loadVirtualDate = async () => {
            const virtualDate = await getVirtualDate();
            console.log('[ProfileScreen] Setting selectedDate to virtual date:', virtualDate);
            setSelectedDate(virtualDate);

            // Also load steps for virtual date
            const steps = await getStepsForDate(virtualDate);
            setSelectedDateSteps(steps);
        };

        loadVirtualDate();

        // If navigation is available, reload on focus
        if (navigation) {
            const unsubscribe = navigation.addListener('focus', () => {
                console.log('[ProfileScreen] Screen focused - reloading virtual date');
                loadVirtualDate();
                loadData();
            });
            return unsubscribe;
        }
    }, [navigation]);

    // Handle date selection from calendar
    const handleDateSelect = async (date: Date) => {
        console.log('[ProfileScreen] Date selected:', date);
        setSelectedDate(date);

        // Load steps for selected date
        const steps = await getStepsForDate(date);
        setSelectedDateSteps(steps);

        // Calculate km for selected date
        const km = getRunningKilometersForDate(allSessions, date);
        setSelectedDateKm(km);

        console.log('[ProfileScreen] Selected date data - steps:', steps, 'km:', km);
    };

    // Update selected date data when allSessions changes
    useEffect(() => {
        if (allSessions.length > 0) {
            handleDateSelect(selectedDate);
        }
    }, [allSessions]);

    const handleClearData = () => {
        Alert.alert(
            'Очистить статистику',
            'Вы уверены? Это действие удалит все ваши тренировки и прогресс безвозвратно.',
            [
                {
                    text: 'Отмена',
                    style: 'cancel',
                },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // Clear all session_* keys
                            const keys = await AsyncStorage.getAllKeys();
                            const sessionKeys = keys.filter(key => key.startsWith('session_'));
                            await AsyncStorage.multiRemove(sessionKeys);
                            await loadData();
                            Alert.alert('Успешно', 'Вся статистика была очищена.');
                        } catch (error) {
                            console.error('Error clearing data:', error);
                            Alert.alert('Ошибка', 'Не удалось очистить данные.');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    const screenWidth = Dimensions.get('window').width;

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>S</Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.nameText}>iSparta Profile</Text>
                    <Text style={styles.dateText}>Workout Statistics</Text>
                </View>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{totalWorkouts}</Text>
                    <Text style={styles.statLabel}>Всего тренировок</Text>
                </View>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{totalReps}</Text>
                    <Text style={styles.statLabel}>Всего повторений</Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{totalMinutes}</Text>
                    <Text style={styles.statLabel}>Всего минут</Text>
                </View>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>👟 {selectedDateSteps}</Text>
                    <Text style={styles.statLabel}>Шагов ({selectedDate.toLocaleDateString('ru', { day: 'numeric', month: 'short' })})</Text>
                </View>
            </View>

            {/* Weekly Streak Calendar */}
            <WeeklyStreakCalendar
                sessions={allSessions}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
            />

            {/* Selected Date Stats */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>
                    📅 {selectedDate.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { flex: 1, marginRight: 5 }]}>
                        <Text style={styles.statValue}>👟 {selectedDateSteps}</Text>
                        <Text style={styles.statLabel}>Шагов</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 1, marginLeft: 5 }]}>
                        <Text style={styles.statValue}>🏃 {selectedDateKm} км</Text>
                        <Text style={styles.statLabel}>Пробежка</Text>
                    </View>
                </View>
                {filterSessionsByDate(allSessions, selectedDate).length === 0 ? (
                    <Text style={styles.emptyText}>Нет тренировок в этот день</Text>
                ) : (
                    filterSessionsByDate(allSessions, selectedDate).map((session, index) => (
                        <TouchableOpacity
                            key={session.sessionId}
                            style={styles.sessionItem}
                            onPress={() => {
                                // Check if session has running data
                                const runningExercise = session.exercises['RUNNING'];
                                if (runningExercise && runningExercise['svg:path[d]']) {
                                    if (navigation?.navigate) {
                                        navigation.navigate('Running', {
                                            screen: 'RunningMap', // Assuming RunningMapScreen is the component for 'Running' tab or nested
                                            params: {
                                                mode: 'VIEWING',
                                                routePoints: runningExercise.route_points,
                                                routeBounds: runningExercise.route_bounds
                                            }
                                        });
                                        // Or if 'Running' tab IS the RunningMapScreen, we might need to pass params differently
                                        // Since TabNavigator maps 'Running' to RunningMapScreen directly:
                                        navigation.navigate('Running', {
                                            mode: 'VIEWING',
                                            routePoints: runningExercise.route_points,
                                            routeBounds: runningExercise.route_bounds
                                        });
                                    }
                                }
                            }}
                        >
                            <Text style={styles.sessionDate}>
                                Тренировка {index + 1}
                            </Text>
                            {Object.entries(session.exercises).map(([exerciseName, record]) => {
                                if (!record.duration && !record.reps && !record.kilometers) return null;
                                const displayName = EXERCISE_NAMES[exerciseName as EXERCISES] || exerciseName;
                                const details = [];
                                if (record.reps) details.push(`${record.reps} повт.`);
                                if (record.duration) details.push(`${Math.round(record.duration)} сек.`);
                                if (record.kilometers) details.push(`${record.kilometers.toFixed(2)} км`);
                                return (
                                    <Text key={exerciseName} style={styles.sessionExercises}>
                                        • {displayName}: {details.join(' + ')}
                                    </Text>
                                );
                            })}
                        </TouchableOpacity>
                    ))
                )}
            </View>

            {/* Recent Sessions */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Последние тренировки</Text>
                {recentSessions.length === 0 ? (
                    <Text style={styles.emptyText}>Нет тренировок</Text>
                ) : (
                    recentSessions.map((session, index) => {
                        // Find corresponding full session for sharing
                        const fullSession = allSessions.find(s => s.sessionId === session.id);

                        return (
                            <View key={session.id} style={styles.sessionItem}>
                                <View style={styles.sessionHeader}>
                                    <Text style={styles.sessionDate}>
                                        {new Date(session.date).toLocaleDateString('ru', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <Text style={styles.sessionDuration}>
                                            {Math.floor(session.totalDurationSeconds / 60)} мин
                                        </Text>
                                        {fullSession && currentUserKey && (
                                            <TouchableOpacity
                                                onPress={() => setPublishingSession(fullSession)}
                                                style={styles.shareButton}
                                            >
                                                <Text style={styles.shareButtonText}>📤</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                <View style={{ marginTop: 4 }}>
                                    {session.exercises.map((exercise, idx) => {
                                        const displayName = EXERCISE_NAMES[exercise.exerciseName] || exercise.exerciseName;
                                        const details = [];
                                        if (exercise.reps) details.push(`${exercise.reps} повт.`);
                                        if (exercise.durationSeconds) details.push(`${Math.round(exercise.durationSeconds)} сек.`);

                                        return (
                                            <Text key={idx} style={styles.sessionExercises}>
                                                • {displayName}: {details.join(' + ')}
                                            </Text>
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Exercise Map Section */}
            <View style={styles.card}>
                <View style={styles.mapHeader}>
                    <Text style={styles.cardTitle}>🗺️ Карта упражнений</Text>
                    <View style={styles.zoomButtons}>
                        <TouchableOpacity onPress={() => setMapScale(prev => Math.max(prev - 0.5, 1))} style={styles.zoomButton}>
                            <Text style={styles.zoomButtonText}>➖</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMapScale(1.5)} style={styles.zoomButton}>
                            <Text style={styles.zoomButtonText}>⟲</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMapScale(prev => Math.min(prev + 0.5, 10))} style={styles.zoomButton}>
                            <Text style={styles.zoomButtonText}>➕</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.mapContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <ScrollView style={{ height: 270 }} showsVerticalScrollIndicator={true}>
                            <ExerciseMapSvg scale={mapScale} />
                        </ScrollView>
                    </ScrollView>
                </View>

                <View style={styles.legend}>
                    <Text style={styles.legendTitle}>Группы мышц</Text>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#FF8A00' }]} />
                        <Text style={styles.legendText}>Руки (Arms)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#16B139' }]} />
                        <Text style={styles.legendText}>Ноги (Legs)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#770072' }]} />
                        <Text style={styles.legendText}>Грудь/Плечи (Torso)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#0026CD' }]} />
                        <Text style={styles.legendText}>Спина (Back)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#FF14A7' }]} />
                        <Text style={styles.legendText}>Продвинутые (Advanced)</Text>
                    </View>
                </View>
            </View>

            {/* Navigation Buttons */}
            <View style={styles.navigationButtons}>
                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonPrimary]}
                    onPress={() => {
                        if (onNavigateToHome) {
                            onNavigateToHome();
                        } else if (navigation?.navigate) {
                            navigation.navigate('Home' as never);
                        }
                    }}
                >
                    <Text style={styles.navButtonText}>🏋️ Начать тренировку</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonSecondary]}
                    onPress={() => {
                        if (onNavigateToLeaderboard) {
                            onNavigateToLeaderboard();
                        } else if (navigation?.navigate) {
                            navigation.navigate('Leaderboard' as never);
                        }
                    }}
                >
                    <Text style={styles.navButtonText}>🏆 Таблица лидеров</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonInfo]}
                    onPress={loadData}
                >
                    <Text style={styles.navButtonText}>🔄 Обновить</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.dangerZone}>
                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonDanger]}
                    onPress={handleClearData}
                >
                    <Text style={styles.navButtonText}>🗑️ Очистить статистику</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />

            {/* Publication Creator Modal */}
            {publishingSession && (
                <PublicationCreator
                    session={publishingSession}
                    visible={!!publishingSession}
                    onClose={() => setPublishingSession(null)}
                    onSuccess={() => {
                        setPublishingSession(null);
                        loadData(); // Refresh data
                    }}
                />
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    loadingText: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 100,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 100,
    },
    header: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#2a2a2a',
        alignItems: 'center',
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4a9eff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
    },
    headerInfo: {
        marginLeft: 15,
        flex: 1,
    },
    nameText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    dateText: {
        color: '#999',
        fontSize: 14,
        marginTop: 4,
    },
    card: {
        backgroundColor: '#2a2a2a',
        margin: 10,
        padding: 15,
        borderRadius: 10,
    },
    cardTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    nraScoreContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    nraScore: {
        color: '#4a9eff',
        fontSize: 48,
        fontWeight: 'bold',
    },
    nraLabel: {
        color: '#999',
        fontSize: 14,
    },
    nraComponents: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    nraComponent: {
        alignItems: 'center',
    },
    componentValue: {
        color: '#4a9eff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    componentLabel: {
        color: 'white',
        fontSize: 12,
        marginTop: 4,
    },
    componentSubLabel: {
        color: '#666',
        fontSize: 10,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 10,
        marginBottom: 10,
    },
    statCard: {
        backgroundColor: '#2a2a2a',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    statValue: {
        color: '#4a9eff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#999',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    weekInfo: {
        gap: 8,
    },
    weekText: {
        color: 'white',
        fontSize: 14,
    },
    weekStat: {
        color: '#999',
        fontSize: 14,
    },
    chartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 180,
        paddingTop: 20,
    },
    chartBar: {
        alignItems: 'center',
        flex: 1,
    },
    bar: {
        backgroundColor: '#4a9eff',
        width: 30,
        borderRadius: 5,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 5,
    },
    barValue: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    barLabel: {
        color: '#999',
        fontSize: 10,
        marginTop: 5,
        textAlign: 'center',
    },
    sessionItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#3a3a3a',
        paddingVertical: 12,
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    sessionDate: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    sessionDuration: {
        color: '#4a9eff',
        fontSize: 14,
    },
    sessionExercises: {
        color: '#999',
        fontSize: 12,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
    },
    navigationButtons: {
        padding: 10,
        gap: 10,
    },
    navButton: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    navButtonPrimary: {
        backgroundColor: '#28a745',
    },
    navButtonSecondary: {
        backgroundColor: '#ffc107',
    },
    navButtonInfo: {
        backgroundColor: '#17a2b8',
    },
    navButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: '#4a9eff',
        padding: 15,
        borderRadius: 10,
        margin: 20,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dangerZone: {
        padding: 10,
        marginTop: 20,
        marginBottom: 20,
    },
    navButtonDanger: {
        backgroundColor: '#dc3545',
    },
    shareButton: {
        padding: 8,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareButtonText: {
        fontSize: 18,
    },
    mapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    mapContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 10,
        marginBottom: 15,
        height: 290,
        overflow: 'hidden',
    },
    zoomButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    zoomButton: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: '#3a3a3a',
        borderRadius: 8,
    },
    zoomButtonText: {
        fontSize: 18,
        color: '#FF14A7',
    },
    legend: {
        marginTop: 5,
    },
    legendTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        color: '#ccc',
    },
});

export default ProfileScreen;
