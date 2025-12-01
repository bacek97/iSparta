/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View, Dimensions } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Camera, useCameraDevice, runAsync, runAtTargetFps } from 'react-native-vision-camera';
import { useEffect, useState, useMemo } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { Svg, Circle, Text } from 'react-native-svg';
import {
  extractDeepFitKeypoints,
  normalizeKeypoints,
  getExerciseName,
  getExerciseProbabilities,
  createExerciseState,
  updateExerciseState,
  type Keypoint,
  type ExerciseState
} from './deepfitUtils';

import { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';
import HandCameraDemo from './nativeTasks';

let globalFrameCounter = 0;

function getBestFormat(
  device: CameraDevice,
  targetWidth: number,
  targetHeight: number,
): CameraDeviceFormat {
  const size = targetWidth * targetHeight;
  return device.formats.reduce((prev, curr) => {
    const currentSize = curr.videoWidth * curr.videoHeight;
    const diff = Math.abs(size - currentSize);

    const previousSize = prev.videoWidth * prev.videoHeight;
    const prevDiff = Math.abs(size - previousSize);
    if (diff < prevDiff) {
      return curr;
    }
    return prev;
  }, device.formats[0]);
}

function tensorToString(tensor: TensorflowModel['inputs'][number]): string {
  return `${tensor.dataType} [${tensor.shape}]`;
}

function App2() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}
function App() {
  const { resize } = useResizePlugin();
  // console.log("App Version: DeepFit-Integration-v1");
  const [hasPermission, setHasPermission] = useState(false)
  const [plugin, setPlugin] = useState<{ model: TensorflowModel | null }>({ model: null })
  const [plugin2, setPlugin2] = useState<{ model: TensorflowModel | null }>({ model: null })
  const [pluginDeepFit, setPluginDeepFit] = useState<{ model: TensorflowModel | null }>({ model: null })
  const lastFrameTime = useSharedValue(Date.now());
  const [keypoints, setKeypoints] = useState<Array<{ x: number, y: number, confidence: number, label: string }>>([]);
  const [exerciseState, setExerciseState] = useState<ExerciseState>(createExerciseState());
  const [exerciseName, setExerciseName] = useState<string>('');

  const updateKeypoints = useRunOnJS((points: Array<{ x: number, y: number, confidence: number, label: string }>) => {
    setKeypoints(points);
  }, [setKeypoints]);

  const runDeepFitClassification = useRunOnJS((points: Keypoint[], frameCount: number) => {
    if (pluginDeepFit.model == null) {
      // console.log('[DeepFit] Model not loaded');
      return;
    }

    try {
      // console.log(`[DeepFit] Starting classification with ${points.length} points`);

      // Extract 18 keypoints for DeepFit
      // console.log('[DeepFit] Step 1: Extracting keypoints...');
      const deepfitKeypoints = extractDeepFitKeypoints(points);
      // console.log(`[DeepFit] Extracted ${deepfitKeypoints.length} keypoints`);

      // Normalize keypoints
      // console.log('[DeepFit] Step 2: Normalizing keypoints...');
      const normalizedInput = normalizeKeypoints(deepfitKeypoints);
      // console.log(`[DeepFit] Normalized: length=${normalizedInput.length}`);

      // Run DeepFit model
      // console.log('[DeepFit] Step 3: Running model...');
      const deepfitOutputs = pluginDeepFit.model!.runSync([normalizedInput]);
      const exerciseProbs = deepfitOutputs[0] as Float32Array;
      // console.log(`[DeepFit] Probs length: ${exerciseProbs.length}`);

      // Get exercise name and probabilities
      // console.log('[DeepFit] Step 4: Getting exercise name...');
      const detectedExercise = getExerciseName(exerciseProbs);
      console.log(`[DeepFit] Exercise: ${detectedExercise}`);
      setExerciseName(detectedExercise);

      const probabilities = getExerciseProbabilities(exerciseProbs);

      // Update exercise state for rep counting
      // console.log('[DeepFit] Step 5: Updating state...');
      const newState = updateExerciseState(detectedExercise, exerciseState, points);
      // console.log(`[DeepFit] State: reps=${newState.count}, form=${newState.form}`);

      // Log results
      if (frameCount % 30 === 0) {
        // console.log('\n=== DEEPFIT EXERCISE CLASSIFICATION ===');
        // console.log(`Exercise: ${detectedExercise}`);
        // console.log(`Reps: ${Math.floor(newState.count)}`);
        // console.log(`Form: ${newState.form === 1 ? 'Good' : 'Bad'}`);
        // console.log(`Feedback: ${newState.feedback}`);
        // console.log(`Completion: ${newState.percentage.toFixed(1)}%`);
        // console.log('Probabilities:', probabilities);
        // console.log('======================================\n');
      }

      // Update state
      setExerciseState(newState);
      // console.log('[DeepFit] ✓ Success!');
    } catch (error) {
      console.error('[DeepFit] ✗ ERROR!');
      console.error('[DeepFit] Error:', error);
      if (error instanceof Error) {
        console.error('[DeepFit] Message:', error.message);
        console.error('[DeepFit] Stack:', error.stack);
      }
    }
  }, [pluginDeepFit, exerciseState, setExerciseState]);

  const updateExerciseStateJS = useRunOnJS((newState: ExerciseState) => {
    setExerciseState(newState);
  }, [setExerciseState]);


  const device = useCameraDevice('front')
  const format = useMemo(
    () => (device != null ? getBestFormat(device, 720, 1000) : undefined),
    [device],
  );

  useEffect(() => {
    Camera.requestCameraPermission().then((p) =>
      setHasPermission(p === 'granted')
    )
  }, [])

  useEffect(() => {
    const loadModel = async (modelAsset: any, setPlugin: (plugin: { model: TensorflowModel | null }) => void, modelName: string) => {
      try {
        // console.log(`Loading ${modelName} TFLite model...`);
        const model = await loadTensorflowModel(
          modelAsset,
          'nnapi' // Android Neural Networks API - good balance of performance and compatibility
        )
        // console.log(`${modelName} model loaded successfully!`);
        setPlugin({ model })

        if (model == null) {
          console.error(`${modelName} model is null after loading`);
          return;
        }
        // console.log(
        //   `${modelName} Model: ${model.inputs.map(tensorToString)} -> ${model.outputs.map(
        //     tensorToString,
        //   )}`,
        // );
      } catch (error) {
        console.error(`Failed to load ${modelName} TFLite model:`, error);
      }
    };

    loadModel(require('./models_tflite/singlepose-lightning-tflite-float16-4.tflite'), setPlugin, 'Pose Detection');
    loadModel(require('./models_tflite/hand_landmarks_detector-from_hand_landmarks_archive.tflite'), setPlugin2, 'Hand Detection');
    loadModel(require('./models_tflite/deepfit_classifier_v3.tflite'), setPluginDeepFit, 'DeepFit Classifier');
  }, [])

  // const { hasPermission } = useCameraPermission()

  const inputTensor = plugin.model?.inputs[0];
  const inputWidth = inputTensor?.shape[1] ?? 0;
  const inputHeight = inputTensor?.shape[2] ?? 0;
  if (inputTensor != null) {
    // console.log(
    //   `Input: ${inputTensor.dataType} ${inputWidth} x ${inputHeight}`,
    // );
  }

  // to get from px -> dp since we draw in the camera coordinate system
  // const SCALE = (format?.videoWidth ?? VIEW_WIDTH) / VIEW_WIDTH;

  // const frameProcessor = useFrameProcessor((frame) => {
  //   'worklet'
  // console.log(`Frame 345: ${frame.width}x${frame.height} (${frame.pixelFormat})`)
  // }, [])
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'

    runAtTargetFps(4, () => {
      'worklet'
      try {
        const now = Date.now();
        const diff = now - lastFrameTime.value;
        if (diff > 0) {
          const fps = 1000 / diff;
          // console.log(`FPS: ${fps.toFixed(1)}`);
        }
        lastFrameTime.value = now;

        lastFrameTime.value = now;

        globalFrameCounter++;
        globalFrameCounter++;
        // console.log(`FrameCounter: ${globalFrameCounter}`);

        // Чередуем модели для лучшей производительности
        // console.log(`Frame: ${frameCounter.value}, Plugin1: ${plugin.model != null}, Plugin2: ${plugin2.model != null}`);
        if (globalFrameCounter % 2 === 0) {
          // Четные кадры - pose detection
          if (plugin.model != null) {
            const inputTensor = plugin.model.inputs[0];
            const width = inputTensor.shape[1] ?? 192;
            const height = inputTensor.shape[2] ?? 192;
            const dataType = inputTensor.dataType === 'float32' ? 'float32' : 'uint8';

            const resized = resize(frame, {
              scale: {
                width: width,
                height: height,
              },
              pixelFormat: 'rgb',
              dataType: dataType,
              rotation: '90deg',
            });

            if (globalFrameCounter % 60 === 0) {
              // console.log(`Pose Model Signature: Inputs: ${plugin.model.inputs.map(t => `${t.dataType}[${t.shape}]`)} Outputs: ${plugin.model.outputs.map(t => `${t.dataType}[${t.shape}]`)}`);
            }
            // console.log('Running Pose Detection');
            const outputs = plugin.model.runSync([resized]);
            const output = outputs[0];
            // console.log(`Output type: ${typeof output}`);
            if (Array.isArray(output) || ArrayBuffer.isView(output)) {
              // console.log(`Output length: ${output.length}`);
              // console.log(`First 5 elements: ${output.slice(0, 5)}`);
            } else {
              // console.log(`Output keys: ${Object.keys(output)}`);
            }


            // Parse keypoints from output (format: [y, x, confidence] for each point)
            const numPoints = output.length / 3;
            const points: Keypoint[] = [];

            // MoveNet 17 keypoint labels
            const keypointLabels = [
              'Nose',           // 0
              'Left Eye',       // 1
              'Right Eye',      // 2
              'Left Ear',       // 3
              'Right Ear',      // 4
              'Left Shoulder',  // 5
              'Right Shoulder', // 6
              'Left Elbow',     // 7
              'Right Elbow',    // 8
              'Left Wrist',     // 9
              'Right Wrist',    // 10
              'Left Hip',       // 11
              'Right Hip',      // 12
              'Left Knee',      // 13
              'Right Knee',     // 14
              'Left Ankle',     // 15
              'Right Ankle'     // 16
            ];

            for (let i = 0; i < numPoints; i++) {
              const y = parseFloat(String(output[i * 3]));
              const x = parseFloat(String(output[i * 3 + 1]));
              const confidence = parseFloat(String(output[i * 3 + 2]));
              points.push({
                y: y,
                x: x,
                confidence: confidence
              });
            }
            // console.log(`Parsed ${points.length} points, first point:`, points[0]);

            // Map to 17 points with labels for display
            const mappedPoints = points.slice(0, 17).map((point, index) => ({
              x: point.x,
              y: point.y,
              confidence: point.confidence,
              label: keypointLabels[index] || `Point ${index}`
            }));

            updateKeypoints(mappedPoints);

            // DeepFit Exercise Classification
            // Support both MediaPipe (33 points) and MoveNet (17 points)
            if (pluginDeepFit.model != null && (points.length === 33 || points.length === 17)) {
              runDeepFitClassification(points, globalFrameCounter);
            }
          } else {
            // console.log('Pose model is not loaded');
          }
        } else {
          // Нечетные кадры - hand detection
          if (plugin2.model != null) {
            const inputTensor = plugin2.model.inputs[0];
            // console.log('Hand Input Tensor Type: ' + inputTensor);
            const width = inputTensor.shape[1] ?? 224;
            const height = inputTensor.shape[2] ?? 224;
            const dataType = inputTensor.dataType === 'float32' ? 'float32' : 'uint8';
            // console.log('Hand Input Tensor Typ8e: ' + dataType + inputTensor.dataType + ' ' + inputTensor.shape[1]);

            const resized = resize(frame, {
              scale: {
                width: width,
                height: height,
              },
              pixelFormat: 'rgb',
              dataType: dataType,
              rotation: '0deg',
            });

            if (globalFrameCounter % 60 === 1) {
              // console.log(`Hand Model Signature: Inputs: ${plugin2.model.inputs.map(t => `${t.dataType}[${t.shape}]`)} Outputs: ${plugin2.model.outputs.map(t => `${t.dataType}[${t.shape}]`)}`);
            }
            // console.log('Running Hand Detection');
            const outputs2 = plugin2.model.runSync([resized]);
            const output = outputs2[0];

            // Parse keypoints from output (format: [y, x, confidence] for each point)
            // Hand model output structure is different. It has 21 landmarks * 3 coordinates = 63 values.
            // The output is just [x, y, z, x, y, z, ...] flattened.
            // Wait, the previous log said: Outputs: float32[1,63],float32[1,1],float32[1,1],float32[1,63]
            // So output[0] is the 63 floats.

            const numPoints = output.length / 3;
            const points = [];

            // Hand landmark labels (21 points)
            const handLabels = [
              'Wrist',           // 0
              'Thumb CMC',       // 1
              'Thumb MCP',       // 2
              'Thumb IP',        // 3
              'Thumb Tip',       // 4
              'Index MCP',       // 5
              'Index PIP',       // 6
              'Index DIP',       // 7
              'Index Tip',       // 8
              'Middle MCP',      // 9
              'Middle PIP',      // 10
              'Middle DIP',      // 11
              'Middle Tip',      // 12
              'Ring MCP',        // 13
              'Ring PIP',        // 14
              'Ring DIP',        // 15
              'Ring Tip',        // 16
              'Pinky MCP',       // 17
              'Pinky PIP',       // 18
              'Pinky DIP',       // 19
              'Pinky Tip'        // 20
            ];

            let max = 0;
            for (let i = 0; i < numPoints; i++) {
              const y = parseFloat(String(output[i * 3])) / height;
              const x = parseFloat(String(output[i * 3 + 1])) / width;
              const confidence = parseFloat(String(output[i * 3 + 2]));
              points.push({
                y: y,
                x: x,
                confidence: confidence,
                label: handLabels[i] || `Hand Point ${i}`
              });
              max = Math.max(max, x);
              max = Math.max(max, y);
            }
            // console.log('max', max);
            // console.log(`Parsed ${points.length} points, first point:`, points[0]);
            updateKeypoints(points);
            // console.log('update Hand Keypoints:', JSON.stringify(points, null, 2));
          } else {
            // console.log('Hand model is not loaded');
          }
        }
      } catch (error) {
        console.error('Frame processor error:', error);
      }
    })
  }, [plugin, plugin2, resize, updateKeypoints, globalFrameCounter])

  const LINE_WIDTH = 5;
  const VIEW_WIDTH = Dimensions.get('screen').width;

  const SCALE = (format?.videoWidth ?? VIEW_WIDTH) / VIEW_WIDTH;



  const lines = [
    // left shoulder -> elbow
    5, 7,
    // right shoulder -> elbow
    6, 8,
    // left elbow -> wrist
    7, 9,
    // right elbow -> wrist
    8, 10,
    // left hip -> knee
    11, 13,
    // right hip -> knee
    12, 14,
    // left knee -> ankle
    13, 15,
    // right knee -> ankle
    14, 16,

    // left hip -> right hip
    11, 12,
    // left shoulder -> right shoulder
    5, 6,
    // left shoulder -> left hip
    5, 11,
    // right shoulder -> right hip
    6, 12,
  ];


  const MIN_CONFIDENCE = 0.45;
  // const emojiFont = useFont(
  //   require('./assets/NotoEmoji-Medium.ttf'),
  //   EMOJI_SIZE * SCALE,
  //   e => console.error(e),
  // );



  const rotation = '0deg'; // hack to get android oriented properly

  // const frameProcessor = useFrameProcessor(
  //   frame => {
  //     'worklet';
  // frame.render();

  // if (plugin.model != null) {
  //   const smaller = resize(frame, {
  //     scale: {
  //       width: inputWidth,
  //       height: inputHeight,
  //     },
  //     pixelFormat: 'rgb',
  //     dataType: 'uint8',
  //     rotation: rotation,
  //   });
  //   const outputs = plugin.model.runSync([smaller]);

  //   const output = outputs[0];
  //   const frameWidth = frame.width;
  //   const frameHeight = frame.height;
  // console.log(`${frameWidth}x${frameHeight}`);
  // console.log(`${inputWidth}x${inputHeight}`)
  // console.log(output)

  //   const rect = Skia.XYWHRect(0, 0, frameWidth, frameHeight);
  //   // frame.drawRect(rect, fillPaint);

  //   for (let i = 0; i < lines.length; i += 2) {
  //     const from = lines[i];
  //     const to = lines[i + 1];

  //     const confidence = output[from * 3 + 2];
  //     if (confidence > MIN_CONFIDENCE) {
  //       frame.drawLine(
  //         Number(output[from * 3 + 1]) * Number(frameWidth),
  //         Number(output[from * 3]) * Number(frameHeight),
  //         Number(output[to * 3 + 1]) * Number(frameWidth),
  //         Number(output[to * 3]) * Number(frameHeight),
  //         paint,
  //       );
  //     }
  //   }

  //   // if (emojiFont != null) {
  //   //   const faceConfidence = output[2];
  //   //   if (faceConfidence > MIN_CONFIDENCE) {
  //   //     const noseY = Number(output[0]) * frame.height + EMOJI_SIZE * 0.3;
  //   //     const noseX = Number(output[1]) * frame.width - EMOJI_SIZE / 2;
  //   //     frame.drawText('😄', noseX, noseY, paint, emojiFont);
  //   //   }
  //   // }
  // }
  //   },
  //   [plugin, paint],
  // );

  if (!hasPermission) return <App2 />
  if (device == null) return <View style={StyleSheet.absoluteFill}><NewAppScreen templateFileName="App.tsx" safeAreaInsets={useSafeAreaInsets()} /></View>

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  // console.log('Keypoints:', JSON.stringify(keypoints, null, 2));

  return (
    <View style={StyleSheet.absoluteFill}>
      
      <HandCameraDemo />
    </View>
  )
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
