import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCurrentUser, getMnemonic, logout } from './authService';
import type { UserData } from './authService';
import * as AutoSync from './autoSyncService';
import * as AuthService from './authService';
import { getPendingSessions, getFailedSessions, syncAllPendingAndFailed } from './autoSyncService';
import { moveToNextDay, moveToPreviousDay, getDateInfo } from './testingUtils';
import { syncStepsToServer, getTodaySteps } from './stepCounterService';

export const SettingsScreen: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [dateInfo, setDateInfo] = useState<string>('');

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const user = await getCurrentUser();
            const mnemonicPhrase = await getMnemonic();
            const autoSync = await AutoSync.getAutoSyncEnabled();
            const pending = await getPendingSessions();
            const failed = await getFailedSessions();

            setUserData(user);
            setMnemonic(mnemonicPhrase);
            setAutoSyncEnabled(autoSync);
            setPendingCount(pending.length);
            setFailedCount(failed.length);
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };


    const handleLogout = () => {
        Alert.alert(
            'Выход',
            'Вы уверены, что хотите выйти?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Выйти',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        if (onLogout) {
                            onLogout();
                        }
                    },
                },
            ]
        );
    };

    const handleToggleAutoSync = async (value: boolean) => {
        try {
            // If enabling auto-sync, register user in Hasura first
            if (value && userData) {
                console.log('[SettingsScreen] Registering user in Hasura:', userData.publicKey);
                try {
                    await AuthService.registerUserInHasura(userData.publicKey, 'JUNIOR');
                    console.log('[SettingsScreen] User registered successfully');
                } catch (error) {
                    console.error('[SettingsScreen] Failed to register user:', error);
                    Alert.alert(
                        'Ошибка регистрации',
                        'Не удалось зарегистрировать пользователя на сервере. Проверьте подключение к интернету.'
                    );
                    return; // Don't enable auto-sync if registration failed
                }
            }

            await AutoSync.setAutoSyncEnabled(value);
            setAutoSyncEnabled(value);
            Alert.alert(
                'Автосинхронизация',
                value
                    ? 'Автосинхронизация включена. Результаты тренировок будут автоматически отправляться на сервер.'
                    : 'Автосинхронизация выключена. Результаты будут сохраняться только локально.'
            );
        } catch (error) {
            console.error('[SettingsScreen] Toggle auto-sync error:', error);
            Alert.alert('Ошибка', 'Не удалось изменить настройку автосинхронизации');
        }
    };

    const handleSyncAll = async () => {
        if (!userData) return;

        setSyncing(true);
        try {
            const result = await syncAllPendingAndFailed({
                publicKey: userData.publicKey,
                fmsCategory: 'JUNIOR',
            });

            // Build message with errors if any
            let message = `Успешно: ${result.synced}\nОшибок: ${result.failed}\nВсего: ${result.total}`;

            if (result.errors && result.errors.length > 0) {
                message += `\n\nДетали ошибок:\n${result.errors.join('\n')}`;
            }

            Alert.alert('Синхронизация завершена', message);

            const pending = await getPendingSessions();
            const failed = await getFailedSessions();
            setPendingCount(pending.length);
            setFailedCount(failed.length);
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось синхронизировать данные');
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    if (!userData) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Не удалось загрузить данные пользователя</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>⚙️ Настройки</Text>
            </View>

            {/* User Info */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Информация о пользователе</Text>

                {userData.nickname && (
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>Никнейм</Text>
                        <Text style={styles.infoValue}>{userData.nickname}</Text>
                    </View>
                )}

                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Сеть</Text>
                    <Text style={styles.infoValue}>{userData.network}</Text>
                </View>
            </View>

            {/* Public Key */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Публичный ключ (ed25519)</Text>
                <View style={styles.credentialCard}>
                    <Text style={styles.credentialText} selectable>{userData.publicKey}</Text>
                </View>
            </View>

            {/* Auto-Sync Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Синхронизация</Text>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Автоматическая синхронизация</Text>
                            <Text style={styles.settingDescription}>
                                Автоматически отправлять результаты тренировок на сервер
                            </Text>
                        </View>
                        <Switch
                            value={autoSyncEnabled}
                            onValueChange={handleToggleAutoSync}
                            trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={styles.syncStatusCard}>
                    <View style={styles.syncStatusRow}>
                        <Text style={styles.syncStatusLabel}>Ожидают синхронизации:</Text>
                        <Text style={styles.syncStatusValue}>{pendingCount}</Text>
                    </View>
                    <View style={styles.syncStatusRow}>
                        <Text style={styles.syncStatusLabel}>Ошибки синхронизации:</Text>
                        <Text style={[styles.syncStatusValue, failedCount > 0 && styles.syncStatusError]}>
                            {failedCount}
                        </Text>
                    </View>
                </View>

                {(pendingCount > 0 || failedCount > 0) && (
                    <TouchableOpacity
                        style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
                        onPress={handleSyncAll}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.syncButtonText}>
                                🔄 Синхронизировать все ({pendingCount + failedCount})
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Mnemonic Phrase */}
            {mnemonic && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Мнемоническая фраза</Text>

                    {/* Security Warning */}
                    <View style={styles.warningCard}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <View style={styles.warningTextContainer}>
                            <Text style={styles.warningTitle}>Важно!</Text>
                            <Text style={styles.warningText}>
                                Никогда не делитесь этой фразой с другими. Любой, у кого есть доступ к ней, может получить полный контроль над вашим аккаунтом.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.credentialCard}>
                        <Text style={styles.mnemonicText} selectable>{mnemonic}</Text>
                    </View>
                </View>
            )}

            {/* Developer Tools */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Инструменты разработчика</Text>

                <View style={styles.devToolsRow}>
                    <TouchableOpacity
                        style={[styles.devToolButton, { backgroundColor: '#17a2b8' }]}
                        onPress={async () => {
                            // Sync current day's steps before moving to next day
                            if (userData?.publicKey) {
                                const todaySteps = await getTodaySteps();
                                console.log('[SettingsScreen] Steps before day change:', todaySteps);

                                if (todaySteps > 0) {
                                    console.log('[SettingsScreen] Syncing steps to server...');
                                    const result = await syncStepsToServer(userData.publicKey, 'JUNIOR');
                                    console.log('[SettingsScreen] Sync result:', result);

                                    if (result.success) {
                                        Alert.alert('Шаги синхронизированы', `${todaySteps} шагов = ${result.points} баллов`);
                                    } else {
                                        Alert.alert('Ошибка синхронизации', result.error || 'Неизвестная ошибка');
                                    }
                                }
                            }

                            const newDate = await moveToNextDay();
                            const info = await getDateInfo();
                            setDateInfo(info);
                            Alert.alert('Следующий день', `Перешли к: ${newDate.toLocaleDateString()}`);
                        }}
                    >
                        <Text style={styles.devToolButtonText}>📅 Следующий день</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.devToolButton, { backgroundColor: '#ffc107' }]}
                        onPress={async () => {
                            const newDate = await moveToPreviousDay();
                            const info = await getDateInfo();
                            setDateInfo(info);
                            Alert.alert('Предыдущий день', `Перешли к: ${newDate.toLocaleDateString()}`);
                        }}
                    >
                        <Text style={styles.devToolButtonText}>⏪ Отменить</Text>
                    </TouchableOpacity>
                </View>

                {dateInfo ? (
                    <Text style={styles.dateInfoText}>{dateInfo}</Text>
                ) : null}
            </View>

            {/* Logout Button */}
            <View style={styles.section}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutButtonText}>🚪 Выйти из аккаунта</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>iSparta v1.0</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        padding: 20,
        backgroundColor: '#1C1C1E',
        borderBottomWidth: 1,
        borderBottomColor: '#38383A',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#8E8E93',
        textAlign: 'center',
        marginTop: 40,
    },
    errorText: {
        fontSize: 16,
        color: '#FF453A',
        textAlign: 'center',
        marginTop: 40,
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#38383A',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 15,
    },
    infoCard: {
        backgroundColor: '#1C1C1E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    infoLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
    },
    credentialCard: {
        backgroundColor: '#1C1C1E',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#38383A',
    },
    credentialText: {
        fontSize: 14,
        color: '#fff',
        fontFamily: 'monospace',
        marginBottom: 15,
        lineHeight: 20,
    },
    mnemonicText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 15,
        lineHeight: 24,
        textAlign: 'center',
    },

    warningCard: {
        backgroundColor: '#2C1810',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#FF9500',
    },
    warningIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    warningTextContainer: {
        flex: 1,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF9500',
        marginBottom: 5,
    },
    warningText: {
        fontSize: 13,
        color: '#FFB84D',
        lineHeight: 18,
    },
    logoutButton: {
        backgroundColor: '#FF453A',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    settingCard: {
        backgroundColor: '#1C1C1E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingInfo: {
        flex: 1,
        marginRight: 15,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
    },
    syncStatusCard: {
        backgroundColor: '#1C1C1E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    syncStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 4,
    },
    syncStatusLabel: {
        fontSize: 14,
        color: '#8E8E93',
    },
    syncStatusValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#34C759',
    },
    syncStatusError: {
        color: '#FF453A',
    },
    syncButton: {
        backgroundColor: '#007AFF',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    syncButtonDisabled: {
        opacity: 0.5,
    },
    syncButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#8E8E93',
    },
    devToolsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    devToolButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    devToolButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    dateInfoText: {
        color: '#8E8E93',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 5,
    },
});

export default SettingsScreen;
