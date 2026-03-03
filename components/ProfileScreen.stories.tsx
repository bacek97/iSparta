import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ProfileScreen } from './ProfileScreen';
import { View } from 'react-native';
import { EXERCISES } from '../common_types';
import { SimpleWorkoutSession } from '../exerciseTrackingService';

type Story = StoryObj<typeof ProfileScreen>;

// Dummy Data
const generateMockSession = (daysAgo: number, overrides: Partial<SimpleWorkoutSession> = {}): SimpleWorkoutSession => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);

    const defaultExercises = Object.values(EXERCISES).reduce((acc, ex) => {
        acc[ex as EXERCISES] = { duration: 0, reps: undefined, kilometers: undefined };
        return acc;
    }, {} as Record<EXERCISES, { duration: number; reps?: number; kilometers?: number }>);

    // Set values only for valid exercises
    defaultExercises[EXERCISES.PUSHUPS] = { duration: 60, reps: 30 };
    defaultExercises[EXERCISES.PULLUPS] = { duration: 120, reps: 15 };
    defaultExercises[EXERCISES.SQUATS] = { duration: 90, reps: 40 };
    defaultExercises[EXERCISES.JUMPING_JACKS] = { duration: 120, reps: 50 };
    defaultExercises[EXERCISES.SITUPS] = { duration: 60, reps: 30 }; // Was CRUNCHES
    defaultExercises[EXERCISES.RUNNING] = { duration: 1800, kilometers: 5.2 };

    return {
        sessionId: `mock-session-${daysAgo}`,
        startTime: d,
        exercises: defaultExercises,
        ...overrides
    };
};

const mockSessions = [
    generateMockSession(0), // Today
    generateMockSession(1), // Yesterday
    generateMockSession(2),
    generateMockSession(4),
];

// Configuration
const meta: Meta<typeof ProfileScreen> = {
    title: 'Screens/ProfileScreen',
    component: ProfileScreen,
    decorators: [
        (Story) => (
            <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
                <Story />
            </View>
        ),
    ],
};
export default meta;

// 1. Setup story with an Empty Profile
export const EmptyProfile: Story = {
    args: {
        initialDate: new Date(),
        initialSessions: [],
        initialSteps: 0,
        initialLoading: false,
        onNavigateToHome: () => console.log('Navigating to Home'),
        onNavigateToLeaderboard: () => console.log('Navigating to Leaderboard'),
        onClearData: () => console.log('Clear Data Pressed'),
        onRefresh: () => console.log('Refresh Pressed'),
    },
};

// 2. Setup story with an Active Profile (lots of data)
export const ActiveProfile: Story = {
    args: {
        initialDate: new Date(),
        initialSessions: mockSessions,
        initialSteps: 8500,
        initialLoading: false,
    },
};

// 3. Setup story for the Loading State
export const LoadingState: Story = {
    args: {
        initialLoading: true,
    },
};
