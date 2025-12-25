import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SessionsList } from '../components/SessionsList';

describe('SessionsList Component', () => {
    const mockSessions = [
        {
            sessionId: 'session-1',
            date: new Date('2024-01-15'),
            basePoints: 50,
            bonusTechFactor: 5,
            bonusSpeed: 3,
            bonusForStarters: 0,
            bonusAnotherMuscleYesterday: 0,
            bonusWeeksInStreak: 0,
            totalPoints: 58,
            exerciseBreakdown: [
                { exercise: 'PUSHUPS' as any, calories: 0, repsOrDuration: 20, points: 30 },
                { exercise: 'SQUATS' as any, calories: 0, repsOrDuration: 30, points: 20 }
            ]
        }
    ];

    it('should render empty when no sessions', () => {
        const { queryByText } = render(<SessionsList sessions={[]} />);
        expect(queryByText('Последние 7 дней')).toBeNull();
    });

    it('should render sessions list', () => {
        const { getByText } = render(<SessionsList sessions={mockSessions} />);
        expect(getByText('Последние 7 дней')).toBeTruthy();
        expect(getByText(/58.0 баллов/)).toBeTruthy();
    });

    it('should expand and collapse session on press', () => {
        const { getByText, queryByText } = render(<SessionsList sessions={mockSessions} />);

        // Initially collapsed
        expect(queryByText(/Базовые:/)).toBeNull();

        // Press to expand
        const sessionCard = getByText(/58.0 баллов/).parent;
        fireEvent.press(sessionCard!);

        // Now expanded
        expect(getByText(/Базовые: 50.0/)).toBeTruthy();
        expect(getByText(/\+ Техника: 5/)).toBeTruthy();

        // Press to collapse
        fireEvent.press(sessionCard!);

        // Collapsed again
        expect(queryByText(/Базовые:/)).toBeNull();
    });

    it('should show exercise breakdown when expanded', () => {
        const { getByText } = render(<SessionsList sessions={mockSessions} />);

        const sessionCard = getByText(/58.0 баллов/).parent;
        fireEvent.press(sessionCard!);

        expect(getByText(/PUSHUPS/i)).toBeTruthy();
        expect(getByText(/30.00 баллов/)).toBeTruthy();
    });
});
