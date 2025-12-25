import React from 'react';
import { render } from '@testing-library/react-native';
import { StatsCard } from '../components/StatsCard';

describe('StatsCard Component', () => {
    it('should render without crashing', () => {
        const { getByText } = render(
            <StatsCard
                totalWorkouts={5}
                totalWorkoutTime={3600}
                totalPoints={125.5}
            />
        );

        expect(getByText('Общая статистика')).toBeTruthy();
    });

    it('should display workout count', () => {
        const { getByText } = render(
            <StatsCard
                totalWorkouts={10}
                totalWorkoutTime={7200}
                totalPoints={250.0}
            />
        );

        expect(getByText('10')).toBeTruthy();
    });

    it('should format duration correctly', () => {
        const { getByText } = render(
            <StatsCard
                totalWorkouts={3}
                totalWorkoutTime={3665} // 1h 1m 5s
                totalPoints={75.5}
            />
        );

        expect(getByText(/1ч 1м/)).toBeTruthy();
    });

    it('should format points with one decimal', () => {
        const { getByText } = render(
            <StatsCard
                totalWorkouts={2}
                totalWorkoutTime={1800}
                totalPoints={99.87}
            />
        );

        expect(getByText('99.9')).toBeTruthy();
    });

    it('should handle zero values', () => {
        const { getByText } = render(
            <StatsCard
                totalWorkouts={0}
                totalWorkoutTime={0}
                totalPoints={0}
            />
        );

        expect(getByText('0')).toBeTruthy();
        expect(getByText('0.0')).toBeTruthy();
        expect(getByText('0с')).toBeTruthy();
    });
});
