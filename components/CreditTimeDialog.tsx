/**
 * Credit Time Dialog Component
 * Shows when user tries to open a tracked app without available time
 * Allows requesting credit time (up to 60 minutes)
 */

import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
} from 'react-native';
import { TIME_BANK_CONSTANTS, TimeBank, calculateAvailableMinutes } from '../appLockTypes';

interface CreditTimeDialogProps {
    visible: boolean;
    appName: string;
    packageName: string;
    timeBank: TimeBank;
    onRequestCredit: (minutes: number) => Promise<boolean>;
    onCancel: () => void;
}

export default function CreditTimeDialog({
    visible,
    appName,
    packageName,
    timeBank,
    onRequestCredit,
    onCancel,
}: CreditTimeDialogProps) {
    const [creditMinutes, setCreditMinutes] = useState('30');
    const [isLoading, setIsLoading] = useState(false);

    const available = calculateAvailableMinutes(timeBank);
    const currentCredit = timeBank.creditMinutes;
    const maxCreditAvailable = TIME_BANK_CONSTANTS.MAX_CREDIT_MINUTES - currentCredit;

    const handleRequestCredit = async () => {
        const minutes = parseInt(creditMinutes, 10);

        if (isNaN(minutes) || minutes < 1) {
            Alert.alert('Ошибка', 'Введите корректное количество минут');
            return;
        }

        if (minutes > maxCreditAvailable) {
            Alert.alert(
                'Превышен лимит',
                `Максимально доступно ${maxCreditAvailable} минут в кредит`
            );
            return;
        }

        setIsLoading(true);
        try {
            const success = await onRequestCredit(minutes);
            if (!success) {
                Alert.alert('Ошибка', 'Не удалось взять кредит');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const presetButtons = [15, 30, 45, 60].filter(m => m <= maxCreditAvailable);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <Text style={styles.title}>⏰ Время исчерпано</Text>

                    <Text style={styles.appName}>{appName}</Text>

                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Доступно:</Text>
                        <Text style={[styles.value, available <= 0 && styles.negative]}>
                            {available} мин
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Текущий долг:</Text>
                        <Text style={[styles.value, currentCredit > 0 && styles.warning]}>
                            {currentCredit} мин
                        </Text>
                    </View>

                    <Text style={styles.sectionTitle}>Взять время в кредит:</Text>

                    <View style={styles.presetContainer}>
                        {presetButtons.map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[
                                    styles.presetButton,
                                    creditMinutes === String(mins) && styles.presetButtonActive
                                ]}
                                onPress={() => setCreditMinutes(String(mins))}
                            >
                                <Text style={[
                                    styles.presetButtonText,
                                    creditMinutes === String(mins) && styles.presetButtonTextActive
                                ]}>
                                    {mins} мин
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={creditMinutes}
                            onChangeText={setCreditMinutes}
                            keyboardType="number-pad"
                            maxLength={2}
                            placeholder="мин"
                            placeholderTextColor="#888"
                        />
                        <Text style={styles.inputLabel}>минут</Text>
                    </View>

                    <Text style={styles.hint}>
                        Максимум: {maxCreditAvailable} мин (лимит: {TIME_BANK_CONSTANTS.MAX_CREDIT_MINUTES} мин)
                    </Text>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onCancel}
                            disabled={isLoading}
                        >
                            <Text style={styles.cancelButtonText}>Отмена</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.creditButton, isLoading && styles.buttonDisabled]}
                            onPress={handleRequestCredit}
                            disabled={isLoading || maxCreditAvailable <= 0}
                        >
                            <Text style={styles.creditButtonText}>
                                {isLoading ? 'Загрузка...' : 'Взять кредит'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.warning}>
                        ⚠️ Кредит нужно будет отработать упражнениями
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    dialog: {
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    appName: {
        fontSize: 18,
        color: '#FF14A7',
        textAlign: 'center',
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    label: {
        fontSize: 16,
        color: '#8E8E93',
    },
    value: {
        fontSize: 16,
        color: '#FFF',
        fontWeight: 'bold',
    },
    negative: {
        color: '#FF3B30',
    },
    warning: {
        color: '#FF9500',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 16,
        color: '#FFF',
        marginTop: 20,
        marginBottom: 12,
    },
    presetContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    presetButton: {
        backgroundColor: '#38383A',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    presetButtonActive: {
        backgroundColor: '#FF14A7',
    },
    presetButtonText: {
        color: '#FFF',
        fontSize: 14,
    },
    presetButtonTextActive: {
        fontWeight: 'bold',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#38383A',
        borderRadius: 8,
        padding: 12,
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        width: 80,
        textAlign: 'center',
    },
    inputLabel: {
        color: '#8E8E93',
        fontSize: 16,
        marginLeft: 12,
    },
    hint: {
        color: '#8E8E93',
        fontSize: 12,
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#38383A',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    creditButton: {
        flex: 1,
        backgroundColor: '#FF14A7',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    creditButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});
