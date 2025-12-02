/**
 * Simple navigation without React Navigation
 * Using state-based screen switching for simplicity
 */

import React, { useState } from 'react';
import WorkoutScreen from './WorkoutScreen';
import ProfileScreen from './ProfileScreen';
import LeaderboardScreen from './LeaderboardScreen';

export type Screen = 'workout' | 'profile' | 'leaderboard';

function Navigation() {
    const [currentScreen, setCurrentScreen] = useState<Screen>('workout');

    const navigateToWorkout = () => setCurrentScreen('workout');
    const navigateToProfile = () => setCurrentScreen('profile');
    const navigateToLeaderboard = () => setCurrentScreen('leaderboard');

    switch (currentScreen) {
        case 'workout':
            return <WorkoutScreen onNavigateToProfile={navigateToProfile} />;

        case 'profile':
            return (
                <ProfileScreen
                    onNavigateToWorkout={navigateToWorkout}
                    onNavigateToLeaderboard={navigateToLeaderboard}
                />
            );

        case 'leaderboard':
            return (
                <LeaderboardScreen
                    onNavigateToProfile={navigateToProfile}
                />
            );

        default:
            return <WorkoutScreen onNavigateToProfile={navigateToProfile} />;
    }
}

export default Navigation;
