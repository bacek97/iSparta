import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { generateMnemonic, register, isNickFree } from './authService';

interface RegisterScreenProps {
    onRegisterSuccess: () => void;
    onNavigateToLogin: () => void;
}

export default function RegisterScreen({ onRegisterSuccess, onNavigateToLogin }: RegisterScreenProps) {
    const [step, setStep] = useState<'generate' | 'confirm' | 'nickname'>('generate');
    const [mnemonic, setMnemonic] = useState('');
    const [words, setWords] = useState<string[]>([]);
    const [confirmWord1, setConfirmWord1] = useState('');
    const [confirmWord2, setConfirmWord2] = useState('');
    const [confirmWord3, setConfirmWord3] = useState('');
    const [nickname, setNickname] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateMnemonic = () => {
        const newMnemonic = generateMnemonic();
        const wordArray = newMnemonic.split(' ');
        setMnemonic(newMnemonic);
        setWords(wordArray);
        setStep('confirm');
    };

    const handleConfirmMnemonic = () => {
        const confirmedMnemonic = `${confirmWord1.trim()} ${confirmWord2.trim()} ${confirmWord3.trim()}`;

        if (confirmedMnemonic !== mnemonic) {
            Alert.alert('Error', 'Words do not match. Please try again.');
            return;
        }

        setStep('nickname');
    };

    const handleRegister = async () => {
        if (!nickname.trim()) {
            Alert.alert('Error', 'Please enter a nickname');
            return;
        }

        // Validate nickname format (alphanumeric, 3-20 chars)
        const nicknameRegex = /^[a-z0-9_]{3,20}$/;
        if (!nicknameRegex.test(nickname.toLowerCase())) {
            Alert.alert(
                'Invalid Nickname',
                'Nickname must be 3-20 characters and contain only letters, numbers, and underscores'
            );
            return;
        }

        setIsLoading(true);

        try {
            // Check if nickname is available
            const available = await isNickFree(nickname.toLowerCase(), 'testnet');

            if (!available) {
                Alert.alert('Error', 'This nickname is already taken. Please choose another.');
                setIsLoading(false);
                return;
            }

            // Register user
            await register(nickname.toLowerCase(), mnemonic, 'testnet');

            Alert.alert(
                'Success!',
                'Your account has been created. Please save your recovery phrase in a safe place.',
                [{ text: 'OK', onPress: onRegisterSuccess }]
            );
        } catch (error) {
            console.error('Registration error:', error);
            Alert.alert('Error', 'Failed to register. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 'generate') {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>
                        We'll generate a secure 3-word recovery phrase for you
                    </Text>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            ⚠️ Your recovery phrase is the ONLY way to access your account.
                            {'\n\n'}
                            Write it down and keep it safe!
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleGenerateMnemonic}
                    >
                        <Text style={styles.buttonText}>Generate Recovery Phrase</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={onNavigateToLogin}
                    >
                        <Text style={styles.linkText}>Already have an account? Login</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (step === 'confirm') {
        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.title}>Your Recovery Phrase</Text>
                    <Text style={styles.subtitle}>
                        Write down these 3 words in order
                    </Text>

                    <View style={styles.mnemonicBox}>
                        {words.map((word, index) => (
                            <View key={index} style={styles.wordContainer}>
                                <Text style={styles.wordNumber}>{index + 1}</Text>
                                <Text style={styles.word}>{word}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.confirmTitle}>Confirm Your Recovery Phrase</Text>
                    <Text style={styles.confirmSubtitle}>
                        Enter the words to confirm you've saved them
                    </Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Word 1"
                            placeholderTextColor="#666"
                            value={confirmWord1}
                            onChangeText={setConfirmWord1}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Word 2"
                            placeholderTextColor="#666"
                            value={confirmWord2}
                            onChangeText={setConfirmWord2}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Word 3"
                            placeholderTextColor="#666"
                            value={confirmWord3}
                            onChangeText={setConfirmWord3}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleConfirmMnemonic}
                    >
                        <Text style={styles.buttonText}>Continue</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    // Nickname step
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Text style={styles.title}>Choose Nickname</Text>
                <Text style={styles.subtitle}>
                    This will be your public username
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="nickname"
                    placeholderTextColor="#666"
                    value={nickname}
                    onChangeText={setNickname}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                />

                <Text style={styles.hint}>
                    3-20 characters, letters, numbers, and underscores only
                </Text>

                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.buttonText}>Create Account</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        paddingTop: 60,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#999',
        marginBottom: 32,
        textAlign: 'center',
    },
    infoBox: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#FF14A7',
    },
    infoText: {
        color: '#FFF',
        fontSize: 14,
        lineHeight: 20,
    },
    mnemonicBox: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 20,
        marginBottom: 32,
    },
    wordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#38383A',
    },
    wordNumber: {
        color: '#666',
        fontSize: 16,
        width: 30,
    },
    word: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '600',
    },
    confirmTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 8,
    },
    confirmSubtitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 20,
    },
    inputContainer: {
        marginBottom: 24,
    },
    input: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#FFF',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#38383A',
    },
    hint: {
        color: '#666',
        fontSize: 12,
        marginBottom: 24,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#FF14A7',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    linkButton: {
        padding: 8,
        alignItems: 'center',
    },
    linkText: {
        color: '#FF14A7',
        fontSize: 14,
    },
});
