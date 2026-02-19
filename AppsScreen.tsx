/**
 * Apps Screen - Tab for managing tracked apps and time bank
 * Shows list of installed apps with checkboxes for tracking
 * Displays time bank status (earned, spent, credit)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
    Alert,
    ActivityIndicator,
} from 'react-native';
import {
    InstalledApp,
    TrackedApp,
    TimeBank,
    calculateAvailableMinutes,
    createDefaultTimeBank,
} from './appLockTypes';
import {
    isAppUsageStatsAvailable,
    hasUsageStatsPermission,
    requestUsageStatsPermission,
    getInstalledApps,
    getTodayUsageForPackages,
    startAppMonitorService,
    stopAppMonitorService,
    updateMonitoredPackages,
    isMonitorServiceRunning,
    updateAvailableTime,
    getSpentMinutesFromNative,
    resetNativeSpentMinutes,
    hasOverlayPermission,
    requestOverlayPermission,
    hasAccessibilityPermission,
    requestAccessibilityPermission,
    saveTrackedPackagesToNative,
} from './appUsageStatsService';
import {
    getTimeBank,
    getTrackedApps,
    saveTrackedApps,
    saveTimeBank,
} from './timeBankService';

// SVG icon for Apps tab
import Svg, { Path, Rect } from 'react-native-svg';

export const AppsIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="3" y="3" width="7" height="7" rx="1" fill={color} />
        <Rect x="14" y="3" width="7" height="7" rx="1" fill={color} />
        <Rect x="3" y="14" width="7" height="7" rx="1" fill={color} />
        <Rect x="14" y="14" width="7" height="7" rx="1" fill={color} />
    </Svg>
);

interface AppItemProps {
    app: TrackedApp;
    usageMinutes?: number;
    onToggle: (packageName: string) => void;
}

function AppItem({ app, usageMinutes, onToggle }: AppItemProps) {
    return (
        <TouchableOpacity
            style={styles.appItem}
            onPress={() => onToggle(app.packageName)}
            activeOpacity={0.7}
        >
            <View style={styles.appIcon}>
                {app.icon ? (
                    <Image
                        source={{ uri: `data:image/png;base64,${app.icon}` }}
                        style={styles.appIconImage}
                    />
                ) : (
                    <View style={styles.appIconPlaceholder}>
                        <Text style={styles.appIconPlaceholderText}>
                            {app.appName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.appInfo}>
                <Text style={styles.appName} numberOfLines={1}>
                    {app.appName}
                </Text>
                {usageMinutes !== undefined && usageMinutes > 0 && (
                    <Text style={styles.appUsage}>
                        Сегодня: {usageMinutes.toFixed(0)} мин
                    </Text>
                )}
            </View>

            <View style={[
                styles.checkbox,
                app.isTracked && styles.checkboxChecked
            ]}>
                {app.isTracked && (
                    <Text style={styles.checkmark}>✓</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

export default function AppsScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
    const [trackedApps, setTrackedApps] = useState<TrackedApp[]>([]);
    const [timeBank, setTimeBank] = useState<TimeBank>(createDefaultTimeBank());
    const [usageData, setUsageData] = useState<Record<string, number>>({});
    const [isModuleAvailable, setIsModuleAvailable] = useState(true);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [hasOverlay, setHasOverlay] = useState(false);
    const [hasAccessibility, setHasAccessibility] = useState(false);

    const loadData = useCallback(async () => {
        try {
            // Check if native module is available
            const available = isAppUsageStatsAvailable();
            setIsModuleAvailable(available);

            if (!available) {
                setIsLoading(false);
                return;
            }

            // Check permission
            const permission = await hasUsageStatsPermission();
            setHasPermission(permission);

            // Check overlay and accessibility permissions
            const overlay = await hasOverlayPermission();
            setHasOverlay(overlay);
            const accessibility = await hasAccessibilityPermission();
            setHasAccessibility(accessibility);

            // Load time bank
            let bank = await getTimeBank();

            // Sync spent minutes from native (tracked by background service)
            const nativeSpentMinutes = await getSpentMinutesFromNative();
            if (nativeSpentMinutes > 0) {
                console.log('[AppsScreen] Adding native spent minutes:', nativeSpentMinutes);
                bank.spentMinutes += nativeSpentMinutes;
                await saveTimeBank(bank);
                await resetNativeSpentMinutes();
            }

            setTimeBank(bank);

            // Sync available time to native SharedPreferences
            const availableMinutes = bank.earnedMinutes - bank.spentMinutes - bank.creditMinutes;
            await updateAvailableTime(availableMinutes);
            console.log('[AppsScreen] Synced available time:', availableMinutes);

            // Load previously tracked apps
            const savedTracked = await getTrackedApps();

            if (permission) {
                // Load installed apps
                const apps = await getInstalledApps();
                setInstalledApps(apps);

                // Merge with saved tracked state
                const merged: TrackedApp[] = apps.map(app => {
                    const saved = savedTracked.find(t => t.packageName === app.packageName);
                    return {
                        ...app,
                        isTracked: saved?.isTracked ?? false,
                    };
                });
                setTrackedApps(merged);

                // Get usage data for tracked apps
                const trackedPackages = merged.filter(a => a.isTracked).map(a => a.packageName);
                if (trackedPackages.length > 0) {
                    const usage = await getTodayUsageForPackages(trackedPackages);
                    setUsageData(usage);

                    // Calculate total spent time from actual Android usage data
                    const totalSpentMinutes = Math.round(
                        Object.values(usage).reduce((sum, mins) => sum + mins, 0)
                    );

                    // Always update time bank with real usage data 
                    console.log('[AppsScreen] Spent minutes from Android:', totalSpentMinutes);
                    bank.spentMinutes = totalSpentMinutes;
                    setTimeBank({ ...bank });
                    await saveTimeBank(bank);

                    // Always sync available time to native
                    const newAvailable = Math.round(bank.earnedMinutes - bank.spentMinutes - bank.creditMinutes);
                    await updateAvailableTime(newAvailable);
                    console.log('[AppsScreen] Synced available time to native:', newAvailable);
                }
            }
        } catch (error) {
            console.error('[AppsScreen] Error loading data:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Reload data when screen comes into focus (e.g., after completing workout)
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const handleRequestPermission = async () => {
        try {
            await requestUsageStatsPermission();
            // Note: User needs to manually enable permission in settings
            // We'll re-check on next focus/refresh
            Alert.alert(
                'Разрешение',
                'Включите доступ к статистике использования для iSparta в настройках Android',
                [{ text: 'OK', onPress: handleRefresh }]
            );
        } catch (error) {
            console.error('[AppsScreen] Error requesting permission:', error);
        }
    };

    const toggleAppTracking = async (packageName: string) => {
        const updated = trackedApps.map(app => {
            if (app.packageName === packageName) {
                return { ...app, isTracked: !app.isTracked };
            }
            return app;
        });

        setTrackedApps(updated);

        // Save to storage
        try {
            await saveTrackedApps(updated);

            // Update usage data if needed
            const newTrackedPackages = updated.filter(a => a.isTracked).map(a => a.packageName);

            // Start or update the monitoring service
            if (newTrackedPackages.length > 0) {
                const usage = await getTodayUsageForPackages(newTrackedPackages);
                setUsageData(usage);

                // Start or update monitoring service
                const serviceRunning = await isMonitorServiceRunning();
                if (serviceRunning) {
                    await updateMonitoredPackages(newTrackedPackages);
                } else {
                    const started = await startAppMonitorService(newTrackedPackages);
                    if (started) {
                        setIsMonitoring(true);
                        console.log('[AppsScreen] Started monitoring service');
                    }
                }

                // Save to native SharedPreferences for accessibility service
                await saveTrackedPackagesToNative(newTrackedPackages);
            } else {
                // No apps tracked, stop the service
                await stopAppMonitorService();
                setIsMonitoring(false);
            }
        } catch (error) {
            console.error('[AppsScreen] Error saving tracked apps:', error);
        }
    };

    const available = calculateAvailableMinutes(timeBank);
    const trackedCount = trackedApps.filter(a => a.isTracked).length;

    // Show message if native module not available (iOS or error)
    if (!isModuleAvailable) {
        return (
            <View style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.title}>📱 Отслеживание приложений</Text>
                    <Text style={styles.subtitle}>
                        Эта функция доступна только на Android
                    </Text>
                </View>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#FF14A7" />
                <Text style={styles.loadingText}>Загрузка приложений...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Time Bank Card */}
            <View style={styles.timeBankCard}>
                <Text style={styles.timeBankTitle}>⏰ Банк времени</Text>

                <View style={styles.timeBankRow}>
                    <View style={styles.timeBankItem}>
                        <Text style={styles.timeBankValue}>{Math.round(timeBank.earnedMinutes)}</Text>
                        <Text style={styles.timeBankLabel}>заработано</Text>
                    </View>
                    <View style={styles.timeBankItem}>
                        <Text style={styles.timeBankValue}>{Math.round(timeBank.spentMinutes)}</Text>
                        <Text style={styles.timeBankLabel}>использовано</Text>
                    </View>
                    <View style={styles.timeBankItem}>
                        <Text style={[
                            styles.timeBankValue,
                            available <= 0 && styles.negativeBankValue
                        ]}>
                            {Math.round(available)}
                        </Text>
                        <Text style={styles.timeBankLabel}>доступно</Text>
                    </View>
                </View>

                {timeBank.creditMinutes > 0 && (
                    <View style={styles.creditWarning}>
                        <Text style={styles.creditWarningText}>
                            ⚠️ Долг: {timeBank.creditMinutes} мин
                        </Text>
                    </View>
                )}
            </View>

            {/* Permission Banner */}
            {!hasPermission && (
                <TouchableOpacity
                    style={styles.permissionBanner}
                    onPress={handleRequestPermission}
                >
                    <Text style={styles.permissionText}>
                        🔓 Нажмите, чтобы включить отслеживание приложений
                    </Text>
                </TouchableOpacity>
            )}

            {/* Overlay Permission Banner */}
            {hasPermission && !hasOverlay && (
                <TouchableOpacity
                    style={[styles.permissionBanner, { backgroundColor: '#ff9800' }]}
                    onPress={async () => {
                        await requestOverlayPermission();
                        loadData();
                    }}
                >
                    <Text style={styles.permissionText}>
                        🎨 Нажмите для разрешения "Поверх других приложений"
                    </Text>
                </TouchableOpacity>
            )}

            {/* Accessibility Permission Banner */}
            {hasPermission && !hasAccessibility && (
                <TouchableOpacity
                    style={[styles.permissionBanner, { backgroundColor: '#9c27b0' }]}
                    onPress={async () => {
                        await requestAccessibilityPermission();
                    }}
                >
                    <Text style={styles.permissionText}>
                        ♿ Нажмите для включения службы специальных возможностей iSparta
                    </Text>
                </TouchableOpacity>
            )}

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    Приложения для отслеживания
                </Text>
                <Text style={styles.headerCount}>
                    Выбрано: {trackedCount}
                </Text>
            </View>

            {/* App List */}
            {hasPermission ? (
                <FlatList
                    data={trackedApps}
                    keyExtractor={item => item.packageName}
                    renderItem={({ item }) => (
                        <AppItem
                            app={item}
                            usageMinutes={usageData[item.packageName]}
                            onToggle={toggleAppTracking}
                        />
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor="#FF14A7"
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                Нет установленных приложений
                            </Text>
                        </View>
                    }
                />
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        Включите разрешение для просмотра списка приложений
                    </Text>
                </View>
            )}

            {/* Help Text */}
            <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                    💪 Зарабатывайте время на вкладке Workout:{'\n'}
                    1 присед = 1 мин • 1 отжимание = 1 мин{'\n'}
                    1 км бега = 1 мин • 100 шагов = 1 мин
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
        textAlign: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#8E8E93',
        fontSize: 16,
    },
    timeBankCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 20,
        margin: 16,
        marginBottom: 8,
    },
    timeBankTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 16,
    },
    timeBankRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    timeBankItem: {
        alignItems: 'center',
    },
    timeBankValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FF14A7',
    },
    negativeBankValue: {
        color: '#FF3B30',
    },
    timeBankLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 4,
    },
    creditWarning: {
        backgroundColor: '#FF950033',
        borderRadius: 8,
        padding: 10,
        marginTop: 16,
    },
    creditWarningText: {
        color: '#FF9500',
        textAlign: 'center',
        fontWeight: '600',
    },
    permissionBanner: {
        backgroundColor: '#FF14A7',
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
    },
    permissionText: {
        color: '#FFF',
        textAlign: 'center',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    headerCount: {
        fontSize: 14,
        color: '#8E8E93',
    },
    listContent: {
        paddingHorizontal: 16,
    },
    appItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    appIcon: {
        width: 48,
        height: 48,
        marginRight: 12,
    },
    appIconImage: {
        width: 48,
        height: 48,
        borderRadius: 10,
    },
    appIconPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#38383A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    appIconPlaceholderText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#8E8E93',
    },
    appInfo: {
        flex: 1,
    },
    appName: {
        fontSize: 16,
        color: '#FFF',
        fontWeight: '500',
    },
    appUsage: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
    checkbox: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: '#38383A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#FF14A7',
        borderColor: '#FF14A7',
    },
    checkmark: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 16,
        textAlign: 'center',
    },
    helpContainer: {
        padding: 16,
        backgroundColor: '#1C1C1E',
        borderTopWidth: 1,
        borderTopColor: '#38383A',
    },
    helpText: {
        color: '#8E8E93',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
});
