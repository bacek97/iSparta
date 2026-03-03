import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { composeStories } from '@storybook/react';

import * as stories from '../components/ProfileScreen.stories';

const { EmptyProfile, ActiveProfile, LoadingState } = composeStories(stories);

describe('ProfileScreen Component (Powered by Storybook)', () => {

    it('renders the EmptyProfile story correctly with 0 values', async () => {
        const { getByText, queryByText, findByText, getAllByText } = render(<EmptyProfile />);

        // Wait for the main component to render
        await findByText('iSparta Profile');

        // Basic Text validations
        expect(getByText('iSparta Profile')).toBeTruthy();
        expect(getByText('Всего тренировок')).toBeTruthy();
        expect(getByText('Всего повторений')).toBeTruthy();
        expect(getByText('Всего минут')).toBeTruthy();

        // Specific to EmptyProfile 
        // 0 workouts and 0 reps
        const zeroElements = getAllByText('0');
        expect(zeroElements.length).toBeGreaterThan(0);

        expect(getByText('Нет тренировок в этот день')).toBeTruthy();
    });

    it('renders the LoadingState story with a loading indicator', () => {
        const { getByText } = render(<LoadingState />);
        expect(getByText('Loading profile...')).toBeTruthy();
    });

    it('handles button presses gracefully in EmptyProfile', async () => {
        const onHomeMock = jest.fn();
        const onLeaderboardMock = jest.fn();
        const onClearDataMock = jest.fn();
        const onRefreshMock = jest.fn();

        const { getByText, findByText } = render(
            <EmptyProfile
                onNavigateToHome={onHomeMock}
                onNavigateToLeaderboard={onLeaderboardMock}
                onClearData={onClearDataMock}
                onRefresh={onRefreshMock}
            />
        );

        // Wait for loading to finish
        await findByText('iSparta Profile');

        // Leaderboard Button
        fireEvent.press(getByText('🏆 Таблица лидеров'));
        expect(onLeaderboardMock).toHaveBeenCalledTimes(1);

        // Refresh Button
        fireEvent.press(getByText('🔄 Обновить'));
        expect(onRefreshMock).toHaveBeenCalledTimes(1);

        // Clear Data Button
        fireEvent.press(getByText('🗑️ Очистить статистику'));
        expect(onClearDataMock).toHaveBeenCalledTimes(1);
    });

    it('renders the ActiveProfile story correctly without crashing', async () => {
        const { getByText, findByText } = render(<ActiveProfile />);

        // Wait for the main component to render
        await findByText('iSparta Profile');

        // Ensure complex components like WeeklyStreakCalendar didn't crash
        expect(getByText('Weekly Streak')).toBeTruthy();
        expect(getByText('Early')).toBeTruthy();
    });

});
