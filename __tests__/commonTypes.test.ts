/**
 * Common Types Tests (TDD - RED Phase)
 * These tests will FAIL until we create common_types.ts
 */

describe('Common Types', () => {
    describe('EXERCISES enum', () => {
        it('should export EXERCISES enum', () => {
            const { EXERCISES } = require('../common_types');
            expect(EXERCISES).toBeDefined();
            expect(EXERCISES.SQUATS).toBe('SQUATS');
            expect(EXERCISES.PUSHUPS).toBe('PUSHUPS');
            expect(EXERCISES.RUNNING).toBe('RUNNING');
        });

        it('should have all exercise types', () => {
            const { EXERCISES } = require('../common_types');
            const exercises = Object.values(EXERCISES);
            expect(exercises.length).toBeGreaterThan(10);
            expect(exercises).toContain('SQUATS');
            expect(exercises).toContain('PUSHUPS');
            expect(exercises).toContain('RUNNING');
        });
    });

    describe('FMS_CATEGORY type', () => {
        it('should export FMS_CATEGORY type', () => {
            const { FMS_CATEGORY } = require('../common_types');
            expect(FMS_CATEGORY).toBeDefined();
            expect(FMS_CATEGORY.JUNIOR).toBe('JUNIOR');
            expect(FMS_CATEGORY.MIDDLE).toBe('MIDDLE');
            expect(FMS_CATEGORY.SENIOR).toBe('SENIOR');
        });
    });

    describe('ExerciseSet interface', () => {
        it('should validate ExerciseSet structure', () => {
            const { validateExerciseSet } = require('../common_types');

            const validSet = {
                hash_shazam: 'test_hash',
                exercise_type: 'PUSHUPS',
                exercise_category: 'REPS',
                set_date: new Date().toISOString(),
                seconds: 120,
                reps: 20
            };

            expect(() => validateExerciseSet(validSet)).not.toThrow();
        });

        it('should support all exercise categories', () => {
            const { EXERCISE_CATEGORY } = require('../common_types');
            expect(EXERCISE_CATEGORY.REPS).toBe('REPS');
            expect(EXERCISE_CATEGORY.KILOMETERS).toBe('KILOMETERS');
            expect(EXERCISE_CATEGORY.SECONDS).toBe('SECONDS');
        });
    });

    describe('WorkoutSession interface', () => {
        it('should validate WorkoutSession structure', () => {
            const { validateWorkoutSession } = require('../common_types');

            const validSession = {
                signature: 'session_123',
                user_public_key: 'ed25519:test',
                session_date: new Date().toISOString(),
                exercise_sets: []
            };

            expect(() => validateWorkoutSession(validSession)).not.toThrow();
        });
    });

    describe('Type Guards', () => {
        it('should provide type guard for REPS exercises', () => {
            const { isRepsExercise, EXERCISES } = require('../common_types');
            expect(isRepsExercise(EXERCISES.SQUATS)).toBe(true);
            expect(isRepsExercise(EXERCISES.PUSHUPS)).toBe(true);
            expect(isRepsExercise(EXERCISES.RUNNING)).toBe(false);
        });

        it('should provide type guard for KILOMETERS exercises', () => {
            const { isKilometersExercise, EXERCISES } = require('../common_types');
            expect(isKilometersExercise(EXERCISES.RUNNING)).toBe(true);
            expect(isKilometersExercise(EXERCISES.CYCLING)).toBe(true);
            expect(isKilometersExercise(EXERCISES.SQUATS)).toBe(false);
        });
    });
});
