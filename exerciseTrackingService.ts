import { EXERCISES, ExerciseType, QueueItem } from './types';
import { BodyAngles, ExerciseCounter, PushupsCounter, SquatsCounter } from './deepfitUtils';

export interface SimpleExerciseRecord {
    duration: number;      // seconds
    reps?: number;         // optional, for rep-based exercises
    direction?: number;    // optional, for rep-based exercises
    exerciseCounter?: ExerciseCounter;
}

export interface ExerciseWithReps extends SimpleExerciseRecord {
    reps: number;
}

export interface SimpleWorkoutSession {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    exercises: Record<EXERCISES, SimpleExerciseRecord>;
}


function isNumberArray(args: unknown[]): args is number[] {
    return args.every(a => typeof a === 'number');
}
function hasNumberFields(
    ex: SimpleExerciseRecord
): ex is Required<SimpleExerciseRecord> {
    return typeof ex?.reps === 'number' && typeof ex?.direction === 'number';
}

export class WorkoutSession {
    s: SimpleWorkoutSession;
    queue: LatestClassifications;
    constructor() {
        console.log('constructorWorkoutSession');
        const initialExercises = Object.values(EXERCISES).reduce((acc, exercise) => {
            acc[exercise] = {
                duration: 0,
                reps: (ExerciseType[exercise] === 'reps') ? 0 : undefined,
                direction: (ExerciseType[exercise] === 'reps') ? 0 : undefined,
                exerciseCounter: (exercise === EXERCISES.PUSHUPS) ? new PushupsCounter(this.incrementReps.bind(this, exercise)) :
                    (exercise === EXERCISES.SQUATS) ? new SquatsCounter(this.incrementReps.bind(this, exercise)) : undefined
            };
            return acc;
        }, {} as Record<EXERCISES, SimpleExerciseRecord>);

        this.s = {
            sessionId: `${Date.now()}`,
            startTime: new Date(),
            exercises: initialExercises,
        };
        this.queue = new LatestClassifications();
    }

    calculate(exercise: EXERCISES, angles: BodyAngles): { duration: number; reps?: number; percent?: number } {
        console.log('exercise', exercise);
        let percent = this.s.exercises[exercise].exerciseCounter?.checkAngles(angles);
        console.log('percent2', percent);
        return {
            duration: this.s.exercises[exercise].duration,
            reps: this.s.exercises[exercise].reps,
            percent: percent
        };
    }

    getJson(): string {
        this.s.endTime = new Date();
        // const save = this.s.exercises.filter((item) => item.duration > 30);
        for (const [key, value] of Object.entries(this.s.exercises)) {
            if (value.duration < 30) {
                delete this.s.exercises[key];
            }
            // delete this.s.exercises[key].exerciseCounter?.checkpoints;
        }
        return JSON.stringify(this.s);
    }
    incrementDuration(exercise: EXERCISES = this.queue.getSmoothedValue()): void {
        this.s.exercises[exercise].duration += 1;
    }
    incrementReps(exercise: EXERCISES = this.queue.getSmoothedValue()): void {
        // if (exercise === this.queue.getSmoothedValue()) {
        const ex = this.s.exercises[exercise];
        if (hasNumberFields(ex)) {
            ex.reps += 1;
            // ex.direction = (ex.direction + 1) % checkpoints[exercise].length;
        }
        // }
    }
    addClassification(qi: QueueItem): void {
        this.queue.add(qi);
    }
}


export class LatestClassifications {
    static queueSize = 10;
    queue: QueueItem[] = Array.from({ length: LatestClassifications.queueSize }, () => ({ name: EXERCISES.UNKNOWN, confidence: 0 }));
    currentIndex: number = 0;

    add(qi: QueueItem): void {
        this.queue[this.currentIndex] = qi;
        this.currentIndex = (this.currentIndex + 1) % LatestClassifications.queueSize;
    }

    getSmoothedValue(): EXERCISES {
        const scores = this.queue.reduce((acc, item) => {
            acc[item.name] = (acc[item.name] || 0) + item.confidence;
            return acc;
        }, {} as Record<EXERCISES, number>);

        return Object.values(EXERCISES).reduce((best, exercise) => {
            const score = scores[exercise] ?? 0;
            return score > (scores[best] ?? 0) ? exercise : best;
        }, EXERCISES.UNKNOWN);
    }
}
