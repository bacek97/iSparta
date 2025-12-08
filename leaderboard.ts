import { WorkoutSession } from "./exerciseTrackingService";
import { EXERCISES } from "./types"

const enum MuscleGroup {
    ARMS,
    LEGS,
    TORSO,
    BACK
}

const enum MuscleGroupRunning {
    RUNNING,
    CYCLING,
    SWIMMING
}

type CalorieCalculationType = 'caloriesPerRep' | 'caloriesPerSecond'

export type MuscleLoad = {
    0: CalorieCalculationType;
    1: { [K in MuscleGroup]: number }
    2: { [K in MuscleGroupRunning]: number }
}

export const caloriesByExercise: Record<EXERCISES, MuscleLoad> =
{
    [EXERCISES.SQUATS]: ['caloriesPerRep', [0.009, 0.186, 0.069, 0.036], [0, 0, 0]],
    [EXERCISES.LUNGES]: ['caloriesPerSecond', [0.010, 0.238, 0.068, 0.023], [0, 0, 0]],
    [EXERCISES.BICEP_CURLS]: ['caloriesPerSecond', [0.112, 0.007, 0.022, 0.007], [0, 0, 0]],
    [EXERCISES.SITUPS]: ['caloriesPerSecond', [0.0095, 0.028, 0.133, 0.019], [0, 0, 0]],
    [EXERCISES.PUSHUPS]: ['caloriesPerRep', [0.130, 0.026, 0.052, 0.052], [0, 0, 0]],
    [EXERCISES.TRICEP_EXTENSIONS]: ['caloriesPerSecond', [0.128, 0.003, 0.015, 0.0045], [0, 0, 0]],
    [EXERCISES.DUMBBELL_ROWS]: ['caloriesPerSecond', [0.072, 0.054, 0.090, 0.144], [0, 0, 0]],
    [EXERCISES.JUMPING_JACKS]: ['caloriesPerSecond', [0.110, 0.330, 0.082, 0.027], [0, 0, 0]],
    [EXERCISES.DUMBBELL_SHOULDER_PRESS]: ['caloriesPerSecond', [0.180, 0.015, 0.060, 0.045], [0, 0, 0]],
    [EXERCISES.LATERAL_SHOULDER_RAISES]: ['caloriesPerSecond', [0.158, 0.006, 0.032, 0.014], [0, 0, 0]],
    [EXERCISES.RUNNING]: ['caloriesPerSecond', [0, 0, 0, 0], [1, 0, 0]],
    [EXERCISES.CYCLING]: ['caloriesPerSecond', [0, 0, 0, 0], [0, 1, 0]],
    [EXERCISES.SWIMMING]: ['caloriesPerSecond', [0.110, 0.330, 0.082, 0.027], [0, 0, 1]],
    [EXERCISES.UNKNOWN]: ['caloriesPerSecond', [0, 0, 0, 0], [0, 0, 0]],
    //   [EXERCISES.PULL_UPS]: [0.339, 0.056, 0.226, 0.509]
}

function calculatePointsBasic(exercise: EXERCISES, workoutSession: WorkoutSession) {
    const { type, calories } = workoutSession
    calories * (type === 'caloriesPerRep' ? reps : duration)
}

function calculatePointsBonusTechFactor(workoutSessionRecord: WorkoutSessionRecord) {
    const { tech_factor } = workoutSessionRecord
    tech_factor = Math.round(tech_factor);
    return [1.15, 1.05, 1.0][tech_factor]
}

function calculatePointsBonusYesterdayAnotherMuscleGroup(workoutSessionRecord: WorkoutSessionRecord) {
    return [1.0, 1.15][isAnother]
}

function bonusByGroupJuniorMiddleSenior(group: MuscleGroup) {
    return [2.0, 1.5, 1.0][group]
}






// export const leaderboard2: Record<EXERCISES, MuscleLoad> =
// {
//     [EXERCISES.SQUATS]: [0.009, 0.186, 0.069, 0.036],
//     [EXERCISES.LUNGES]: [0.010, 0.238, 0.068, 0.023],
//     [EXERCISES.BICEP_CURLS]: [0.112, 0.007, 0.022, 0.007],
//     [EXERCISES.SITUPS]: [0.0095, 0.028, 0.133, 0.019],
//     [EXERCISES.PUSHUPS]: [0.130, 0.026, 0.052, 0.052],
//     [EXERCISES.TRICEP_EXTENSIONS]: [0.128, 0.003, 0.015, 0.0045],
//     [EXERCISES.DUMBBELL_ROWS]: [0.072, 0.054, 0.090, 0.144],
//     [EXERCISES.JUMPING_JACKS]: [0.110, 0.330, 0.082, 0.027],
//     [EXERCISES.DUMBBELL_SHOULDER_PRESS]: [0.180, 0.015, 0.060, 0.045],
//     [EXERCISES.LATERAL_SHOULDER_RAISES]: [0.158, 0.006, 0.032, 0.014],
//     [EXERCISES.UNKNOWN]: [0, 0, 0, 0],
//     //   [EXERCISES.PULL_UPS]: [0.339, 0.056, 0.226, 0.509]
// }

// SQUATS = 'SQUATS',
// LUNGES = 'LUNGES',
// BICEP_CURLS = 'BICEP_CURLS',
// SITUPS = 'SITUPS',
// PUSHUPS = 'PUSHUPS',
// TRICEP_EXTENSIONS = 'TRICEP_EXTENSIONS',
// DUMBBELL_ROWS = 'DUMBBELL_ROWS',
// JUMPING_JACKS = 'JUMPING_JACKS',
// DUMBBELL_SHOULDER_PRESS = 'DUMBBELL_SHOULDER_PRESS',
// LATERAL_SHOULDER_RAISES = 'LATERAL_SHOULDER_RAISES',
// UNKNOWN = 'UNKNOWN'