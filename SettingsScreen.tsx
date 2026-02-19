import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCurrentUser, getMnemonic, logout, updateNickname, login } from './authService';
import type { UserData } from './authService';
import AuthNavigator from './AuthNavigator';
import * as AutoSync from './autoSyncService';
import * as AuthService from './authService';
import { getPendingSessions, getFailedSessions, syncAllPendingAndFailed } from './autoSyncService';
import { moveToNextDay, moveToPreviousDay, getDateInfo } from './testingUtils';
import { syncStepsToServer, getTodaySteps } from './stepCounterService';
import { subscribeToGroupPublications } from './publicationsService';
import { showNewPublicationNotification, initializeNotifications, showTestNotification } from './notificationService';
import { useGroupData } from './hooks/useGroupData';

export const SettingsScreen: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [dateInfo, setDateInfo] = useState<string>('');
    const [subscriptionActive, setSubscriptionActive] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string>('Не подключено');
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Account switch modal
    const [showAccountSwitch, setShowAccountSwitch] = useState(false);

    // Nickname editing
    const [editingNickname, setEditingNickname] = useState('');
    const [savingNickname, setSavingNickname] = useState(false);

    // Workout display settings
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [showFPS, setShowFPS] = useState(true);
    const [showProgressBar, setShowProgressBar] = useState(true);
    const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

    // Workout mode
    const [manualMode, setManualMode] = useState(true);

    // Camera orientation settings
    const [rotationAngle, setRotationAngle] = useState<0 | 90 | 180 | 270>(0);
    const [flipX, setFlipX] = useState(false);
    const [flipY, setFlipY] = useState(true);

    const { userGroup } = useGroupData();

    useEffect(() => {
        loadUserData();
        initializeNotifications();

        // Cleanup subscription on unmount
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    const loadUserData = async () => {
        try {
            const user = await getCurrentUser();
            const mnemonicPhrase = await getMnemonic();
            const autoSync = await AutoSync.getAutoSyncEnabled();
            const pending = await getPendingSessions();
            const failed = await getFailedSessions();

            // Load workout display settings
            const storedShowSkeleton = await AsyncStorage.getItem('@iSparta:showSkeleton');
            const storedShowFPS = await AsyncStorage.getItem('@iSparta:showFPS');
            const storedShowProgressBar = await AsyncStorage.getItem('@iSparta:showProgressBar');
            const storedShowAdditionalInfo = await AsyncStorage.getItem('@iSparta:showAdditionalInfo');

            // Load camera orientation settings
            const storedRotationAngle = await AsyncStorage.getItem('@iSparta:rotationAngle');
            const storedFlipX = await AsyncStorage.getItem('@iSparta:flipX');
            const storedFlipY = await AsyncStorage.getItem('@iSparta:flipY');

            setUserData(user);
            setMnemonic(mnemonicPhrase);
            setEditingNickname(user?.nickname || '');
            setAutoSyncEnabled(autoSync);
            setPendingCount(pending.length);
            setFailedCount(failed.length);

            // Set display settings (defaults: skeleton=ON, FPS=ON, progressBar=ON, additionalInfo=OFF)
            if (storedShowSkeleton !== null) setShowSkeleton(storedShowSkeleton === 'true');
            if (storedShowFPS !== null) setShowFPS(storedShowFPS === 'true');
            if (storedShowProgressBar !== null) setShowProgressBar(storedShowProgressBar === 'true');
            if (storedShowAdditionalInfo !== null) setShowAdditionalInfo(storedShowAdditionalInfo === 'true');

            // Load manual mode setting (default: ON)
            const storedManualMode = await AsyncStorage.getItem('@iSparta:manualMode');
            if (storedManualMode !== null) setManualMode(storedManualMode === 'true');

            // Set camera orientation settings
            if (storedRotationAngle !== null) setRotationAngle(parseInt(storedRotationAngle) as 0 | 90 | 180 | 270);
            if (storedFlipX !== null) setFlipX(storedFlipX === 'true');
            if (storedFlipY !== null) setFlipY(storedFlipY === 'true');
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };


    const handleSwitchAccount = () => {
        Alert.alert(
            'Сменить аккаунт',
            'Для смены аккаунта введите мнемоническую фразу другого аккаунта.',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Сменить',
                    onPress: () => {
                        setShowAccountSwitch(true);
                    },
                },
            ]
        );
    };

    const handleAccountSwitchSuccess = () => {
        setShowAccountSwitch(false);
        loadUserData(); // Reload user data after account switch
    };

    const handleSaveNickname = async () => {
        if (!editingNickname.trim()) {
            Alert.alert('Ошибка', 'Никнейм не может быть пустым');
            return;
        }

        setSavingNickname(true);
        try {
            await updateNickname(editingNickname.trim());
            setUserData(prev => prev ? { ...prev, nickname: editingNickname.trim() } : null);
            Alert.alert('Успешно', 'Никнейм сохранён');
        } catch (error) {
            console.error('Error saving nickname:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить никнейм');
        } finally {
            setSavingNickname(false);
        }
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

    const handleSubscribe = () => {
        if (!userData?.publicKey || !userGroup?.group_id) {
            Alert.alert('Ошибка', 'Необходимо войти в группу для подписки на публикации');
            return;
        }

        // Unsubscribe if already subscribed
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
            setSubscriptionActive(false);
            setSubscriptionStatus('Отключено');
            Alert.alert('Подписка', 'Подписка на публикации отключена');
            return;
        }

        try {
            console.log('[SettingsScreen] Starting subscription for group:', userGroup.group_id);
            setSubscriptionStatus('Подключение...');

            unsubscribeRef.current = subscribeToGroupPublications(
                userGroup.group_id,
                userData.publicKey,
                (publications) => {
                    console.log('[SettingsScreen] Received publications:', publications.length);
                    setSubscriptionActive(true);
                    setSubscriptionStatus(`Активно (${publications.length} публ.)`);
                },
                (newPublication) => {
                    console.log('[SettingsScreen] New publication received!');
                    showNewPublicationNotification(newPublication);
                    Alert.alert('📬 Новая публикация!',
                        `${newPublication.user_public_key.slice(0, 12)}... поделился тренировкой`
                    );
                }
            );

            Alert.alert('Подписка', 'Подписка на публикации запущена. При новых публикациях вы получите уведомление.');
        } catch (error) {
            console.error('[SettingsScreen] Subscription error:', error);
            setSubscriptionStatus('Ошибка подключения');
            Alert.alert('Ошибка', 'Не удалось подписаться на публикации');
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

                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Никнейм</Text>
                    <View style={styles.nicknameRow}>
                        <TextInput
                            style={styles.nicknameInput}
                            value={editingNickname}
                            onChangeText={setEditingNickname}
                            placeholder="Не задан"
                            placeholderTextColor="#8E8E93"
                            editable={!savingNickname}
                        />
                        <TouchableOpacity
                            style={[styles.saveNicknameButton, savingNickname && styles.saveNicknameButtonDisabled]}
                            onPress={handleSaveNickname}
                            disabled={savingNickname || editingNickname === (userData?.nickname || '')}
                        >
                            {savingNickname ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveNicknameButtonText}>Сохранить</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

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

            {/* Publications Subscription */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Подписка на публикации</Text>

                <View style={styles.syncStatusCard}>
                    <View style={styles.syncStatusRow}>
                        <Text style={styles.syncStatusLabel}>Статус подписки:</Text>
                        <Text style={[
                            styles.syncStatusValue,
                            subscriptionActive ? { color: '#34C759' } : { color: '#8E8E93' }
                        ]}>
                            {subscriptionStatus}
                        </Text>
                    </View>
                    {userGroup?.group_id && (
                        <View style={styles.syncStatusRow}>
                            <Text style={styles.syncStatusLabel}>Группа:</Text>
                            <Text style={styles.syncStatusValue}>
                                {userGroup.group_id.slice(0, 20)}...
                            </Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.syncButton,
                        subscriptionActive && { backgroundColor: '#FF453A' }
                    ]}
                    onPress={handleSubscribe}
                    disabled={!autoSyncEnabled}
                >
                    <Text style={styles.syncButtonText}>
                        {subscriptionActive ? '🔴 Отключить подписку' : '📡 Подписаться на публикации'}
                    </Text>
                </TouchableOpacity>

                {!autoSyncEnabled && (
                    <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                        Включите автосинхронизацию для подписки
                    </Text>
                )}

                <TouchableOpacity
                    style={[styles.syncButton, { backgroundColor: '#5856D6', marginTop: 12 }]}
                    onPress={async () => {
                        const result = await showTestNotification();
                        Alert.alert('Тест уведомления', result);
                    }}
                >
                    <Text style={styles.syncButtonText}>🔔 Тестовое уведомление</Text>
                </TouchableOpacity>
            </View>

            {/* Workout Display Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Отображение на тренировке</Text>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Режим тренировки</Text>
                            <Text style={styles.settingDescription}>
                                {manualMode ? '✋ Ручной режим — запись и отправка данных' : '🤖 Авто режим — автоматическое распознавание'}
                            </Text>
                        </View>
                        <Switch
                            value={manualMode}
                            onValueChange={async (value) => {
                                setManualMode(value);
                                await AsyncStorage.setItem('@iSparta:manualMode', value.toString());
                            }}
                            trackColor={{ false: '#3A3A3C', true: '#6f42c1' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Скелет</Text>
                            <Text style={styles.settingDescription}>
                                Отображать скелет позы (может снижать FPS)
                            </Text>
                        </View>
                        <Switch
                            value={showSkeleton}
                            onValueChange={async (value) => {
                                setShowSkeleton(value);
                                await AsyncStorage.setItem('@iSparta:showSkeleton', value.toString());
                            }}
                            trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>FPS</Text>
                            <Text style={styles.settingDescription}>
                                Показывать счётчик кадров в секунду
                            </Text>
                        </View>
                        <Switch
                            value={showFPS}
                            onValueChange={async (value) => {
                                setShowFPS(value);
                                await AsyncStorage.setItem('@iSparta:showFPS', value.toString());
                            }}
                            trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Прогресс-бар</Text>
                            <Text style={styles.settingDescription}>
                                Показывать вертикальную шкалу прогресса
                            </Text>
                        </View>
                        <Switch
                            value={showProgressBar}
                            onValueChange={async (value) => {
                                setShowProgressBar(value);
                                await AsyncStorage.setItem('@iSparta:showProgressBar', value.toString());
                            }}
                            trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Дополнительная информация</Text>
                            <Text style={styles.settingDescription}>
                                Показывать Confidence, Presence, Duration и другие данные
                            </Text>
                        </View>
                        <Switch
                            value={showAdditionalInfo}
                            onValueChange={async (value) => {
                                setShowAdditionalInfo(value);
                                await AsyncStorage.setItem('@iSparta:showAdditionalInfo', value.toString());
                            }}
                            trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* Camera Orientation Settings */}
                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>🔄 Угол поворота: {rotationAngle}°</Text>
                            <Text style={styles.settingDescription}>
                                Поворот изображения камеры
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.rotationButton]}
                            onPress={async () => {
                                const angles: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
                                const currentIndex = angles.indexOf(rotationAngle);
                                const nextIndex = (currentIndex + 1) % angles.length;
                                const newAngle = angles[nextIndex];
                                setRotationAngle(newAngle);
                                await AsyncStorage.setItem('@iSparta:rotationAngle', newAngle.toString());
                            }}
                        >
                            <Text style={styles.rotationButtonText}>{rotationAngle}°</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>↔️ Отзеркалить по X</Text>
                            <Text style={styles.settingDescription}>
                                Горизонтальное отражение изображения
                            </Text>
                        </View>
                        <Switch
                            value={flipX}
                            onValueChange={async (value) => {
                                setFlipX(value);
                                await AsyncStorage.setItem('@iSparta:flipX', value.toString());
                            }}
                            trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>↕️ Отзеркалить по Y</Text>
                            <Text style={styles.settingDescription}>
                                Вертикальное отражение изображения
                            </Text>
                        </View>
                        <Switch
                            value={flipY}
                            onValueChange={async (value) => {
                                setFlipY(value);
                                await AsyncStorage.setItem('@iSparta:flipY', value.toString());
                            }}
                            trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>
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

            {/* Account Switch Button */}
            <View style={styles.section}>
                <TouchableOpacity style={styles.switchAccountButton} onPress={handleSwitchAccount}>
                    <Text style={styles.switchAccountButtonText}>🔑 Сменить аккаунт</Text>
                </TouchableOpacity>
            </View>

            {/* Account Switch Modal */}
            <Modal
                visible={showAccountSwitch}
                animationType="slide"
                presentationStyle="fullScreen"
            >
                <AuthNavigator onAuthSuccess={handleAccountSwitchSuccess} />
            </Modal>

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
    nicknameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    nicknameInput: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        backgroundColor: '#2C2C2E',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#38383A',
    },
    saveNicknameButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
    },
    saveNicknameButtonDisabled: {
        opacity: 0.5,
    },
    saveNicknameButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    switchAccountButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    switchAccountButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    rotationButton: {
        backgroundColor: '#9c27b0',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    rotationButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default SettingsScreen;
