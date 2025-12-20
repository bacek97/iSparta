import React, { useState } from 'react';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';

interface AuthNavigatorProps {
    onAuthSuccess: () => void;
}

export default function AuthNavigator({ onAuthSuccess }: AuthNavigatorProps) {
    const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

    if (currentScreen === 'login') {
        return (
            <LoginScreen
                onLoginSuccess={onAuthSuccess}
                onNavigateToRegister={() => setCurrentScreen('register')}
            />
        );
    }

    return (
        <RegisterScreen
            onRegisterSuccess={onAuthSuccess}
            onNavigateToLogin={() => setCurrentScreen('login')}
        />
    );
}
