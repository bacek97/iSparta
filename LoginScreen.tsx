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
} from 'react-native';
import { validateMnemonic, deriveNearKeys, checkUserExistsOnServer, login } from './authService';

interface LoginScreenProps {
    onLoginSuccess: () => void;
    onNavigateToRegister: () => void;
}

export default function LoginScreen({ onLoginSuccess, onNavigateToRegister }: LoginScreenProps) {
    const [word1, setWord1] = useState('');
    const [word2, setWord2] = useState('');
    const [word3, setWord3] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        const mnemonic = `${word1.trim()} ${word2.trim()} ${word3.trim()}`;

        // Validate input
        if (!word1 || !word2 || !word3) {
            Alert.alert('Error', 'Please enter all 3 words');
            return;
        }

        // Validate mnemonic
        if (!validateMnemonic(mnemonic)) {
            Alert.alert('Error', 'Invalid mnemonic phrase. Please check your words.');
            return;
        }

        setIsLoading(true);

        try {
            // Derive keys from mnemonic
            const { publicKey } = deriveNearKeys(mnemonic);

            // Check if user exists on server
            const serverUser = await checkUserExistsOnServer(publicKey);

            if (!serverUser) {
                Alert.alert(
                    'Account Not Found',
                    'No account found with this mnemonic on the server. Would you like to register?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Register', onPress: onNavigateToRegister },
                    ]
                );
                setIsLoading(false);
                return;
            }

            // User exists on server - save credentials locally and login
            await login(mnemonic);

            // Login successful
            console.log('[LoginScreen] Login successful for user:', publicKey);
            onLoginSuccess();
        } catch (error) {
            console.error('Login error:', error);
            Alert.alert('Error', 'Failed to login. Please check your network connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Enter your 3-word recovery phrase</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Word 1"
                        placeholderTextColor="#666"
                        value={word1}
                        onChangeText={setWord1}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Word 2"
                        placeholderTextColor="#666"
                        value={word2}
                        onChangeText={setWord2}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Word 3"
                        placeholderTextColor="#666"
                        value={word3}
                        onChangeText={setWord3}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.buttonText}>Login</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={onNavigateToRegister}
                    disabled={isLoading}
                >
                    <Text style={styles.linkText}>Don't have an account? Register</Text>
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
        marginBottom: 40,
        textAlign: 'center',
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
