/**
 * Notification Service
 * Handles local push notifications for new publications
 * Uses @notifee/react-native for F-Droid compatibility (no Google Play Services)
 */

import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import type { PublicationWithWorkout } from './common_types';

const CHANNEL_ID = 'isparta-publications';

/**
 * Initialize notification channels (call on app start)
 */
export async function initializeNotifications(): Promise<void> {
    try {
        await notifee.createChannel({
            id: CHANNEL_ID,
            name: 'Публикации группы',
            description: 'Уведомления о новых публикациях участников группы',
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            vibration: true,
            sound: 'default',
        });
        console.log('[NotificationService] Channel created');
    } catch (error) {
        console.error('[NotificationService] Failed to create channel:', error);
    }
}

/**
 * Show notification for new publication from group member
 */
export async function showNewPublicationNotification(
    publication: PublicationWithWorkout
): Promise<void> {
    try {
        // Format user display
        const userDisplay = publication.user_public_key.slice(0, 12) + '...';

        // Count exercises and points
        const exercises = publication.workout_session?.exercise_sets || [];
        const exerciseCount = exercises.length;
        const points = publication.workout_session?.total_points || 0;

        // Build notification body
        let body = `${userDisplay} `;
        if (exerciseCount > 0) {
            body += ` (${exerciseCount} упр.)`;
        }
        if (points > 0) {
            body += ` — ${points} очков`;
        }

        // Add publication text if present
        if (publication.text_content && publication.text_content.trim()) {
            body += `\n"${publication.text_content.trim()}"`;
        }

        await notifee.displayNotification({
            title: '🏋️ Новая публикация',
            body,
            android: {
                channelId: CHANNEL_ID,
                smallIcon: 'ic_launcher', // Use app icon (ic_notification doesn't exist)
                importance: AndroidImportance.HIGH,
                pressAction: {
                    id: 'default',
                },
            },
        });

        console.log('[NotificationService] Notification displayed');
    } catch (error) {
        console.error('[NotificationService] Failed to display notification:', error);
    }
}

/**
 * Request notification permissions (Android 13+)
 */
export async function requestNotificationPermission(): Promise<boolean> {
    try {
        const settings = await notifee.requestPermission();
        console.log('[NotificationService] Permission status:', settings.authorizationStatus);
        return settings.authorizationStatus >= 1; // AUTHORIZED or PROVISIONAL
    } catch (error) {
        console.error('[NotificationService] Permission request failed:', error);
        return false;
    }
}

/**
 * Show a test notification for debugging
 */
export async function showTestNotification(): Promise<string> {
    try {
        // Request permission first
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
            return 'Нет разрешения на уведомления';
        }

        // Ensure channel exists
        await initializeNotifications();

        // Display test notification
        const notificationId = await notifee.displayNotification({
            title: '🔔 Тестовое уведомление',
            body: `Это тестовое уведомление. Время: ${new Date().toLocaleTimeString()}`,
            android: {
                channelId: CHANNEL_ID,
                smallIcon: 'ic_launcher', // Use app icon
                importance: AndroidImportance.HIGH,
                pressAction: {
                    id: 'default',
                },
            },
        });

        console.log('[NotificationService] Test notification sent:', notificationId);
        return `Уведомление отправлено (ID: ${notificationId})`;
    } catch (error) {
        console.error('[NotificationService] Test notification failed:', error);
        return `Ошибка: ${error}`;
    }
}
