/**
 * Comparison Test Script for iSparta TypeScript Implementation
 * This script processes exercise photos and captures all intermediate results
 * from the TypeScript DeepFit implementation for comparison with Python.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    extractDeepFitKeypoints,
    normalizeKeypoints,
    getExerciseName,
    getExerciseProbabilities,
    Keypoint,
    EXERCISE_LABELS
} from './deepfitUtils';

// Mock MediaPipe landmarks - in real scenario, these would come from MediaPipe
// For testing, we'll read them from the Python output
interface ProcessedImage {
    image: string;
    success: boolean;
    mediapipe_33_landmarks?: Array<{
        id: number;
        x: number;
        y: number;
        z: number;
        visibility: number;
    }>;
    image_size?: {
        width: number;
        height: number;
    };
    error?: string;
}

interface TypeScriptResult {
    image: string;
    success: boolean;
    deepfit_18_keypoints?: Array<{ x: number; y: number; confidence: number }>;
    blocked_format?: number[];
    normalization_details?: {
        length_body: number;
        center_x: number;
        center_y: number;
    };
    normalized_interleaved?: number[];
    prediction?: string;
    probabilities?: Record<string, number>;
    error?: string;
}

/**
 * Convert MediaPipe 33 landmarks to Keypoint format
 */
function convertMediaPipeToKeypoints(landmarks: ProcessedImage['mediapipe_33_landmarks']): Keypoint[] {
    if (!landmarks) return [];

    return landmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        confidence: lm.visibility
    }));
}

/**
 * Calculate normalization details (simplified version for TS)
 */
function calculateNormalizationDetails(keypoints: Keypoint[]): {
    length_body: number;
    center_x: number;
    center_y: number;
} {
    // Helper function for euclidean distance
    const euclideanDist = (a: Keypoint, b: Keypoint): number => {
        if ((a.x === 0 && a.y === 0) || (b.x === 0 && b.y === 0)) {
            return 0;
        }
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    };

    // Calculate head length
    const lengthHead = Math.max(
        euclideanDist(keypoints[1], keypoints[17]),  // Neck to LEar
        euclideanDist(keypoints[1], keypoints[16]),  // Neck to REar
        euclideanDist(keypoints[1], keypoints[15]),  // Neck to LEye
        euclideanDist(keypoints[1], keypoints[14]),  // Neck to REye
        euclideanDist(keypoints[0], keypoints[17]),  // Nose to LEar
        euclideanDist(keypoints[0], keypoints[16]),  // Nose to REar
        euclideanDist(keypoints[0], keypoints[15]),  // Nose to LEye
        euclideanDist(keypoints[0], keypoints[14])   // Nose to REye
    );

    // Calculate torso length
    const lengthTorso = Math.max(
        euclideanDist(keypoints[1], keypoints[11]),  // Neck to LHip
        euclideanDist(keypoints[1], keypoints[8])    // Neck to RHip
    );

    // Calculate leg lengths
    const lengthLegRight = euclideanDist(keypoints[8], keypoints[9]) + euclideanDist(keypoints[9], keypoints[10]);
    const lengthLegLeft = euclideanDist(keypoints[11], keypoints[12]) + euclideanDist(keypoints[12], keypoints[13]);
    const lengthLeg = Math.max(lengthLegRight, lengthLegLeft);

    // Total body length
    let lengthBody = lengthHead + lengthTorso + lengthLeg;
    if (lengthBody === 0) {
        lengthBody = 1;
    }

    // Calculate center of gravity
    let sumX = 0, sumY = 0, count = 0;
    for (const kp of keypoints) {
        if (kp.x > 0 || kp.y > 0) {
            sumX += kp.x;
            sumY += kp.y;
            count++;
        }
    }
    const centerX = count > 0 ? sumX / count : 0;
    const centerY = count > 0 ? sumY / count : 0;

    return {
        length_body: lengthBody,
        center_x: centerX,
        center_y: centerY
    };
}

/**
 * Process image using TypeScript implementation
 */
function processImageTypeScript(pythonResult: ProcessedImage): TypeScriptResult {
    const result: TypeScriptResult = {
        image: pythonResult.image,
        success: false
    };

    if (!pythonResult.success || !pythonResult.mediapipe_33_landmarks) {
        result.error = pythonResult.error || 'No landmarks available';
        return result;
    }

    try {
        // Step 1: Convert MediaPipe landmarks to Keypoint format
        const mediapipeLandmarks = convertMediaPipeToKeypoints(pythonResult.mediapipe_33_landmarks);

        // Step 2: Extract DeepFit 18 keypoints
        const deepfit18 = extractDeepFitKeypoints(mediapipeLandmarks);
        result.deepfit_18_keypoints = deepfit18;

        // Step 3: Create blocked format for comparison
        const blocked: number[] = [];
        for (const kp of deepfit18) {
            blocked.push(kp.x);
        }
        for (const kp of deepfit18) {
            blocked.push(kp.y);
        }
        result.blocked_format = blocked;

        // Step 4: Calculate normalization details
        result.normalization_details = calculateNormalizationDetails(deepfit18);

        // Step 5: Normalize keypoints
        const normalized = normalizeKeypoints(deepfit18);
        result.normalized_interleaved = Array.from(normalized);

        // Note: We cannot run the TFLite model in Node.js without additional setup
        // This would require react-native-pytorch-core or similar
        result.prediction = 'N/A - TFLite model requires React Native environment';
        result.probabilities = {};

        result.success = true;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
}

/**
 * Main function
 */
async function main() {
    const pythonResultsDir = path.join('c:', 'tmp', 'classification', 'comparison_results');
    const outputDir = pythonResultsDir;

    // Read all Python results
    const allPythonResultsPath = path.join(pythonResultsDir, 'all_python_results.json');

    if (!fs.existsSync(allPythonResultsPath)) {
        console.error(`Error: Python results not found at ${allPythonResultsPath}`);
        console.error('Please run test_comparison.py first to generate Python results.');
        process.exit(1);
    }

    console.log('Reading Python results...');
    const pythonResults: ProcessedImage[] = JSON.parse(
        fs.readFileSync(allPythonResultsPath, 'utf-8')
    );

    console.log(`Found ${pythonResults.length} Python results\n`);

    const allTsResults: TypeScriptResult[] = [];

    // Process each result
    for (let idx = 0; idx < pythonResults.length; idx++) {
        const pythonResult = pythonResults[idx];
        const imageName = path.basename(pythonResult.image);

        console.log(`Processing [${idx + 1}/${pythonResults.length}]: ${imageName}`);

        const tsResult = processImageTypeScript(pythonResult);
        allTsResults.push(tsResult);

        if (tsResult.success) {
            console.log(`  ✓ Processed successfully`);
        } else {
            console.log(`  ✗ Error: ${tsResult.error}`);
        }

        // Save individual result
        const outputFile = path.join(
            outputDir,
            `${path.parse(imageName).name}_typescript_result.json`
        );
        fs.writeFileSync(outputFile, JSON.stringify(tsResult, null, 2));
    }

    // Save combined results
    const combinedOutput = path.join(outputDir, 'all_typescript_results.json');
    fs.writeFileSync(combinedOutput, JSON.stringify(allTsResults, null, 2));

    console.log(`\n✓ All results saved to: ${outputDir}`);
    console.log(`✓ Combined results: ${combinedOutput}`);

    // Print summary
    const successful = allTsResults.filter(r => r.success).length;
    console.log(`\nSummary: ${successful}/${allTsResults.length} images processed successfully`);

    // Create comparison report
    createComparisonReport(pythonResults, allTsResults, outputDir);
}

/**
 * Create a comparison report between Python and TypeScript results
 */
function createComparisonReport(
    pythonResults: ProcessedImage[],
    tsResults: TypeScriptResult[],
    outputDir: string
) {
    console.log('\n=== Creating Comparison Report ===\n');

    const report: any[] = [];

    for (let i = 0; i < pythonResults.length; i++) {
        const py = pythonResults[i];
        const ts = tsResults[i];

        if (!py.success || !ts.success) {
            continue;
        }

        const imageName = path.basename(py.image);

        // Compare blocked format
        const blockedDiff = compareArrays(
            py.blocked_format || [],
            ts.blocked_format || []
        );

        // Compare normalized format
        const normalizedDiff = compareArrays(
            py.normalized_interleaved || [],
            ts.normalized_interleaved || []
        );

        const comparison = {
            image: imageName,
            python_prediction: py.prediction,
            blocked_format_match: blockedDiff.maxDiff < 0.01,
            blocked_format_max_diff: blockedDiff.maxDiff,
            blocked_format_avg_diff: blockedDiff.avgDiff,
            normalized_format_match: normalizedDiff.maxDiff < 0.001,
            normalized_format_max_diff: normalizedDiff.maxDiff,
            normalized_format_avg_diff: normalizedDiff.avgDiff,
            normalization_details_diff: {
                length_body_diff: Math.abs(
                    (py.normalization_details?.length_body || 0) -
                    (ts.normalization_details?.length_body || 0)
                ),
                center_x_diff: Math.abs(
                    (py.normalization_details?.center_x || 0) -
                    (ts.normalization_details?.center_x || 0)
                ),
                center_y_diff: Math.abs(
                    (py.normalization_details?.center_y || 0) -
                    (ts.normalization_details?.center_y || 0)
                )
            }
        };

        report.push(comparison);

        console.log(`${imageName}:`);
        console.log(`  Python prediction: ${py.prediction}`);
        console.log(`  Blocked format match: ${comparison.blocked_format_match ? '✓' : '✗'} (max diff: ${comparison.blocked_format_max_diff.toFixed(6)})`);
        console.log(`  Normalized format match: ${comparison.normalized_format_match ? '✓' : '✗'} (max diff: ${comparison.normalized_format_max_diff.toFixed(6)})`);
    }

    // Save comparison report
    const reportPath = path.join(outputDir, 'comparison_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Comparison report saved to: ${reportPath}`);
}

/**
 * Compare two arrays and return difference metrics
 */
function compareArrays(arr1: number[], arr2: number[]): {
    maxDiff: number;
    avgDiff: number;
} {
    if (arr1.length !== arr2.length) {
        return { maxDiff: Infinity, avgDiff: Infinity };
    }

    let maxDiff = 0;
    let sumDiff = 0;

    for (let i = 0; i < arr1.length; i++) {
        const diff = Math.abs(arr1[i] - arr2[i]);
        maxDiff = Math.max(maxDiff, diff);
        sumDiff += diff;
    }

    return {
        maxDiff,
        avgDiff: sumDiff / arr1.length
    };
}

// Run the script
main().catch(console.error);
