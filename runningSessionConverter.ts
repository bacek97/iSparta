/**
 * Running Session to Workout Converter
 * Converts RunningTrackingService sessions to exerciseTrackingService format
 */

import type { RunningSession, GPSPoint } from './runningTrackingService';
import type { SimpleWorkoutSession, SimpleExerciseRecord } from './exerciseTrackingService';
import { EXERCISES } from './types';
import * as SvgUtils from './svgPathUtils';

/**
 * Convert running session to workout session format
 */
export function convertRunningToWorkout(
    runningSession: RunningSession
): SimpleWorkoutSession {
    const runningRecord: SimpleExerciseRecord = {
        duration: runningSession.metrics.duration,
        kilometers: runningSession.metrics.distance,
        'svg:path[d]': generateSvgPath(runningSession.route),
        route_points: runningSession.route,
        route_bounds: calculateBounds(runningSession.route),
    };

    return {
        sessionId: runningSession.sessionId,
        startTime: new Date(runningSession.startTime),
        endTime: runningSession.endTime ? new Date(runningSession.endTime) : new Date(),
        exercises: {
            [EXERCISES.RUNNING]: runningRecord,
        } as Record<EXERCISES, SimpleExerciseRecord>,
    };
}

/**
 * Convert kilometers to steps
 * Average: 1250 steps per kilometer
 */
export function kilometersToSteps(km: number): number {
    return Math.round(km * 1250);
}

/**
 * Generate SVG path from GPS route
 * Uses existing svgPathUtils for consistency
 */
function generateSvgPath(route: GPSPoint[]): string {
    if (route.length === 0) {
        return '';
    }

    // Convert GPS coordinates to SVG path using existing utils
    return SvgUtils.coordinatesToSvgPath(route, 100, 100);
}

/**
 * Calculate bounds for route
 */
function calculateBounds(route: GPSPoint[]): SvgUtils.RouteBounds {
    return SvgUtils.getRouteBounds(route);
}
