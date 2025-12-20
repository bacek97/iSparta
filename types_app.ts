// Группы упражнений
export enum NOTIMPLEMENTED_EXERCISES {
    LUNGES = 'LUNGES',
    BICEP_CURLS = 'BICEP_CURLS',
    SITUPS = 'SITUPS',
    TRICEP_EXTENSIONS = 'TRICEP_EXTENSIONS',
    DUMBBELL_ROWS = 'DUMBBELL_ROWS',
    JUMPING_JACKS = 'JUMPING_JACKS',
    DUMBBELL_SHOULDER_PRESS = 'DUMBBELL_SHOULDER_PRESS',
    LATERAL_SHOULDER_RAISES = 'LATERAL_SHOULDER_RAISES',
}

export enum REPS_EXERCISES {
    SQUATS = 'SQUATS',
    PUSHUPS = 'PUSHUPS'
}

export enum KILOMETERS_EXERCISES {
    RUNNING = 'RUNNING',
    CYCLING = 'CYCLING',
    SWIMMING = 'SWIMMING',
}

export type EXERCISES = NOTIMPLEMENTED_EXERCISES | REPS_EXERCISES | KILOMETERS_EXERCISES;

// Базовые данные сета
interface BaseSetData {
    seconds: number;
    date: Date;
    hashShazam: string;
}

// Специфичные данные для каждой группы
export interface SecondsSetData { }

export interface RepsSetData {
    reps: number;
}

export interface KilometersSetData {
    kilometers: number;
    'svg:path[d]': string;
}

// GeneralSet как Record всех упражнений (exercise в ключе, не в значении)
export type GeneralSet = {
    [K in REPS_EXERCISES]: BaseSetData & RepsSetData
} & {
    [K in KILOMETERS_EXERCISES]: BaseSetData & KilometersSetData
} & {
    [K in NOTIMPLEMENTED_EXERCISES]: BaseSetData & SecondsSetData
};

// Пример использования
let g: Partial<GeneralSet> = {
    [REPS_EXERCISES.SQUATS]: {
        // exercise больше не нужен - он уже в ключе
        seconds: 10,
        date: new Date(),
        hashShazam: '123',
        reps: 10
    }
}

export interface WorkoutSession {
    exercises: Partial<GeneralSet>;
    date: Date;
    publicKey: `ed25519:${string}`;
    signature: `ed25519:${string}`;
    publication?: {
        text?: string;
        images?: `base64:${string}`[];
    }
}

let w: WorkoutSession = {
    exercises: {
        [REPS_EXERCISES.SQUATS]: {
            seconds: 10,
            date: new Date(),
            hashShazam: '123',
            reps: 10
        },
        [KILOMETERS_EXERCISES.RUNNING]: {
            seconds: 10,
            date: new Date(),
            hashShazam: '123',
            kilometers: 10,
            'svg:path[d]': 'path'
        }
    },
    date: new Date(),
    publicKey: 'ed25519:abc',
    signature: 'ed25519:def',
    publication: {
        text: 'text',
        images: ['base64:abc']
    }
}

