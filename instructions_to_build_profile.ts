/**
 * @fileoverview TypeScript-прототип системы Недельного Рейтинга Активности (НРА).
 * Включает формулы для долгосрочного множителя, чередования групп мышц и динамического WAS.
 */

/**
 * @description Основные константы, используемые в расчете НРА.
 */
const SCORING_CONSTANTS = {
    // 1. Константы Множителя Постоянства (МС)
    STREAK_MULTIPLIER_BASE: 1,
    STREAK_MULTIPLIER_RATE: 0.05, // 5% за каждую неделю Стрика

    // 2. Константы Дисциплины Чередования
    BASE_DAILY_SCORE: 25,
    ALTERNATION_BONUS: 10,
    REPETITION_PENALTY_FACTOR: 0.7, // Штраф -70% при повторении группы
    WEEKLY_PERFECT_STREAK_BONUS: 100,

    // 3. Константы Динамического WAS (Объем)
    BASE_WAS_SCORE: 100, // Базовый WAS при поддержании темпа
    MAX_WAS_BOOST: 150, // Максимальный бонус WAS (+150 к базе 100 = 250)

    // 4. Константы Мастерства (WMS)
    WMS_RANK_I: 150,
    WMS_RANK_II: 250,
    WMS_RANK_III: 400,
    WMS_RANK_IV: 600,
} as const;

/**
 * @description Перечисление пяти основных групп мышц и кардио, используемых для чередования.
 * 'NONE' используется для обозначения дней отдыха.
 */
export enum MuscleGroup {
    NONE = 'NONE',
    ARMS = 'ARMS', // Руки
    LEGS = 'LEGS', // Ноги
    CHEST = 'CHEST', // Грудь
    BACK = 'BACK', // Спина
    CARDIO = 'CARDIO', // Бег/Кардио
}

/**
 * @description Карта баллов за достижение нового Ранга в группе (WMS).
 */
export const WMS_POINTS_MAP: Record<number, number> = {
    1: SCORING_CONSTANTS.WMS_RANK_I,
    2: SCORING_CONSTANTS.WMS_RANK_II,
    3: SCORING_CONSTANTS.WMS_RANK_III,
    4: SCORING_CONSTANTS.WMS_RANK_IV,
};

/**
 * @description Структура данных для активности в конкретный день.
 */
export interface DailyActivity {
    day: number; // 1-7
    group: MuscleGroup;
}

/**
 * @description Общая структура данных для расчета НРА.
 */
export interface WeeklyNRAData {
    longTermStreakWeeks: number; // Длинный Стрик для расчета МС
    dailyLog: DailyActivity[]; // Лог активности за последние 7 дней
    currentVolume: number; // Общий объем (репсы/минуты) за текущую неделю
    personalPace: number; // Личный Темп (средний объем за последние 4 недели)
    newRanksAchieved: number[]; // Массив достигнутых Рангов (1, 2, 3, или 4)
}

/**
 * @function calculateLongTermMultiplier
 * @description Рассчитывает Множитель Постоянства (МС) на основе долгосрочного Стрика.
 * МС обеспечивает экспоненциальное преимущество долгосрочной дисциплине.
 * Формула: МС = 1 + (Текущий Стрик в неделях * 0.05)
 *
 * @param longTermStreakWeeks Количество непрерывных недель Стрика.
 * @returns Множитель, который будет применен к базовому НРА.
 */
export function calculateLongTermMultiplier(longTermStreakWeeks: number): number {
    if (longTermStreakWeeks <= 0) return SCORING_CONSTANTS.STREAK_MULTIPLIER_BASE;

    return (
        SCORING_CONSTANTS.STREAK_MULTIPLIER_BASE +
        longTermStreakWeeks * SCORING_CONSTANTS.STREAK_MULTIPLIER_RATE
    );
}

/**
 * @function calculateWeeklyDisciplineScore
 * @description Рассчитывает Недельный Счет Дисциплины (WDS) с учетом чередования и штрафов за перетренированность.
 *
 * @param dailyLog Лог активности за последние 7 дней (должен содержать 7 элементов).
 * @returns Общий счет Дисциплины за неделю до применения МС.
 */
export function calculateWeeklyDisciplineScore(dailyLog: DailyActivity[]): number {
    let totalScore = 0;
    let daysTrainedCount = 0;

    for (let i = 0; i < dailyLog.length; i++) {
        const currentActivity = dailyLog[i];
        const yesterdayActivity = dailyLog[i - 1];
        let dailyScore = 0;

        if (currentActivity.group === MuscleGroup.NONE) {
            // День отдыха, баллы не начисляются
            continue;
        }

        daysTrainedCount++;
        dailyScore = SCORING_CONSTANTS.BASE_DAILY_SCORE;

        // 1. Штраф за Повтор (Перетренированность)
        if (
            yesterdayActivity &&
            yesterdayActivity.group !== MuscleGroup.NONE &&
            currentActivity.group === yesterdayActivity.group
        ) {
            dailyScore *= (1 - SCORING_CONSTANTS.REPETITION_PENALTY_FACTOR);
        }

        // 2. Бонус Чередования
        if (
            !yesterdayActivity || // Первый день Стрика
            yesterdayActivity.group === MuscleGroup.NONE ||
            currentActivity.group !== yesterdayActivity.group
        ) {
            dailyScore += SCORING_CONSTANTS.ALTERNATION_BONUS;
        }

        totalScore += dailyScore;
    }

    // 3. Бонус Недельного Постоянства (за 7 активных дней)
    if (daysTrainedCount === dailyLog.length) {
        totalScore += SCORING_CONSTANTS.WEEKLY_PERFECT_STREAK_BONUS;
    }

    return totalScore;
}

/**
 * @function calculateDynamicWas
 * @description Рассчитывает Динамический Счет Активности (WAS) на основе отклонения от Личного Темпа (PP).
 * WAS поощряет рост и наказывает спад относительно индивидуальной базы пользователя.
 *
 * @param currentVolume Общий объем (reps/duration) за текущую неделю.
 * @param personalPace Личный Темп (средний объем за последние 4 недели).
 * @returns Корректированный WAS.
 */
export function calculateDynamicWas(currentVolume: number, personalPace: number): number {
    // Избегаем деления на ноль, если PP равен 0 (например, у новых пользователей)
    if (personalPace === 0) {
        return currentVolume > 0 ? SCORING_CONSTANTS.BASE_WAS_SCORE : 0;
    }

    const deviation = (currentVolume - personalPace) / personalPace; // % отклонения

    let scoreAdjustment = 0;

    if (deviation >= 0.5) {
        // Прорыв (+50% и более)
        scoreAdjustment = SCORING_CONSTANTS.MAX_WAS_BOOST;
    } else if (deviation >= 0.2) {
        // Активный Рост (+20% и более)
        scoreAdjustment = 80;
    } else if (deviation <= -0.5) {
        // Критический Спад (-50% и более)
        scoreAdjustment = -100;
    } else if (deviation <= -0.2) {
        // Спад (-20% и более)
        scoreAdjustment = -50;
    }
    // В диапазоне [-20%, +20%] корректировка 0

    const newWAS = SCORING_CONSTANTS.BASE_WAS_SCORE + scoreAdjustment;

    // Ограничение максимального WAS до 250 и минимального до 0
    return Math.max(0, Math.min(newWAS, SCORING_CONSTANTS.BASE_WAS_SCORE + SCORING_CONSTANTS.MAX_WAS_BOOST));
}

/**
 * @function calculateWeeklyMasteryBonus
 * @description Рассчитывает Бонус Мастерства (WMS) за новые Ранги, достигнутые на текущей неделе.
 * Этот бонус является разовым ускорителем рейтинга.
 *
 * @param newRanksAchieved Массив достигнутых Рангов (1, 2, 3 или 4).
 * @returns Общий Бонус WMS.
 */
export function calculateWeeklyMasteryBonus(newRanksAchieved: number[]): number {
    return newRanksAchieved.reduce((total, rank) => {
        const points = WMS_POINTS_MAP[rank];
        return total + (points || 0);
    }, 0);
}

/**
 * @function calculateNRA
 * @description ФИНАЛЬНАЯ ФУНКЦИЯ. Рассчитывает полный Недельный Рейтинг Активности (НРА).
 * Формула: НРА = (WDS * МС) + WMS + WAS_динамический
 *
 * @param data Все входные данные для расчета НРА.
 * @returns Общий НРА за текущую неделю.
 */
export function calculateNRA(data: WeeklyNRAData): number {
    // 1. Расчет WDS (Дисциплина Чередования)
    const weeklyDisciplineScore = calculateWeeklyDisciplineScore(data.dailyLog);

    // 2. Расчет МС (Множитель Постоянства)
    const longTermMultiplier = calculateLongTermMultiplier(data.longTermStreakWeeks);

    // 3. Расчет НРА (База)
    const nraBase = weeklyDisciplineScore * longTermMultiplier;

    // 4. Расчет WMS (Бонус Мастерства)
    const masteryBonus = calculateWeeklyMasteryBonus(data.newRanksAchieved);

    // 5. Расчет WAS (Динамический Объем)
    const dynamicWAS = calculateDynamicWas(data.currentVolume, data.personalPace);

    // Итоговый НРА
    const finalNRA = nraBase + masteryBonus + dynamicWAS;

    return Math.round(finalNRA);
}