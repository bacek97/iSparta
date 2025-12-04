import { EXERCISES, QueueItem } from './types';

export interface SimpleExerciseRecord {
    duration: number;      // seconds
    reps?: number;         // optional, for rep-based exercises
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

export class WorkoutSession {
    s: SimpleWorkoutSession;
    queue: LatestClassifications;
    constructor() {
        const initialExercises = Object.values(EXERCISES).reduce((acc, exercise) => {
            acc[exercise] = {
                duration: 0,
                reps: 0
            };
            return acc;
        }, {} as Record<EXERCISES, SimpleExerciseRecord>);

        this.s = {
            sessionId: `session_${Date.now()}`,
            startTime: new Date(),
            exercises: initialExercises,
        };
        this.queue = new LatestClassifications();
    }

    getJson(): string {
        this.s.endTime = new Date();
        return JSON.stringify(this.s);
    }
    incrementDuration(exercise: EXERCISES = this.queue.getSmoothedValue()): void {
        this.s.exercises[exercise].duration += 1;
    }
    incrementReps(exercise: EXERCISES = this.queue.getSmoothedValue()): void {
        if (typeof (this.s.exercises[exercise].reps) === 'number') {
            this.s.exercises[exercise].reps += 1;
        }
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
