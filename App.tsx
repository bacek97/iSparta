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
import { Svg, Circle } from 'react-native-svg';

import { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';

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
  console.log("App Version: Debug-Fix-2");
  const [hasPermission, setHasPermission] = useState(false)
  const [plugin, setPlugin] = useState<{ model: TensorflowModel | null }>({ model: null })
  const [plugin2, setPlugin2] = useState<{ model: TensorflowModel | null }>({ model: null })
  const lastFrameTime = useSharedValue(Date.now());
  // const frameCounter = useSharedValue(0);
  const [keypoints, setKeypoints] = useState<Array<{ x: number, y: number, confidence: number }>>([]);

  const updateKeypoints = useRunOnJS((points: Array<{ x: number, y: number, confidence: number }>) => {
    setKeypoints(points);
  }, [setKeypoints]);


  const device = useCameraDevice('back')
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
    const loadModel = async (modelAsset: any, setPlugin: (plugin: { model: TensorflowModel | null }) => void) => {
      try {
        console.log(`Loading TFLite model with asset ID: ${modelAsset}`);
        const model = await loadTensorflowModel(
          modelAsset,
          // 'default'
          // 'default',
          // 'nnapi' // Android Neural Networks API - good balance of performance and compatibility
        )
        console.log('Model loaded successfully!');
        setPlugin({ model })

        if (model == null) {
          console.error('Model is null after loading');
          return;
        }
        console.log(
          `Model: ${model.inputs.map(tensorToString)} -> ${model.outputs.map(
            tensorToString,
          )}`,
        );
      } catch (error) {
        console.error('Failed to load TFLite model:', error);
      }
    };

    loadModel(require('./models_tflite/singlepose-lightning-tflite-float16-4.tflite'), setPlugin);
    loadModel(require('./models_tflite/hand_landmarks_detector.tflite'), setPlugin2);
  }, [])

  // const { hasPermission } = useCameraPermission()

  const inputTensor = plugin.model?.inputs[0];
  const inputWidth = inputTensor?.shape[1] ?? 0;
  const inputHeight = inputTensor?.shape[2] ?? 0;
  if (inputTensor != null) {
    console.log(
      `Input: ${inputTensor.dataType} ${inputWidth} x ${inputHeight}`,
    );
  }

  // to get from px -> dp since we draw in the camera coordinate system
  // const SCALE = (format?.videoWidth ?? VIEW_WIDTH) / VIEW_WIDTH;

  // const frameProcessor = useFrameProcessor((frame) => {
  //   'worklet'
  //   console.log(`Frame 345: ${frame.width}x${frame.height} (${frame.pixelFormat})`)
  // }, [])
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'

    runAtTargetFps(30, () => {
      'worklet'
      try {
        const now = Date.now();
        const diff = now - lastFrameTime.value;
        if (diff > 0) {
          const fps = 1000 / diff;
          console.log(`FPS: ${fps.toFixed(1)}`);
        }
        lastFrameTime.value = now;

        lastFrameTime.value = now;

        globalFrameCounter++;
        console.log(`FrameCounter: ${globalFrameCounter}`);

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
              rotation: '0deg',
            });

            if (globalFrameCounter % 60 === 0) {
              console.log(`Pose Model Signature: Inputs: ${plugin.model.inputs.map(t => `${t.dataType}[${t.shape}]`)} Outputs: ${plugin.model.outputs.map(t => `${t.dataType}[${t.shape}]`)}`);
            }
            console.log('Running Pose Detection');
            const outputs = plugin.model.runSync([resized]);
            const output = outputs[0];
            console.log(`Output type: ${typeof output}`);
            if (Array.isArray(output) || ArrayBuffer.isView(output)) {
              console.log(`Output length: ${output.length}`);
              console.log(`First 5 elements: ${output.slice(0, 5)}`);
            } else {
              console.log(`Output keys: ${Object.keys(output)}`);
            }


            // Parse keypoints from output (format: [y, x, confidence] for each point)
            const numPoints = output.length / 3;
            const points = [];
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
            console.log(`Parsed ${points.length} points, first point:`, points[0]);
            updateKeypoints(points);
          } else {
            console.log('Pose model is not loaded');
          }
        } else {
          // Нечетные кадры - hand detection
          if (plugin2.model != null) {
            const inputTensor = plugin2.model.inputs[0];
            console.log('Hand Input Tensor Type: ' + inputTensor);
            const width = inputTensor.shape[1] ?? 224;
            const height = inputTensor.shape[2] ?? 224;
            const dataType = inputTensor.dataType === 'float32' ? 'float32' : 'uint8';

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
              console.log(`Hand Model Signature: Inputs: ${plugin2.model.inputs.map(t => `${t.dataType}[${t.shape}]`)} Outputs: ${plugin2.model.outputs.map(t => `${t.dataType}[${t.shape}]`)}`);
            }
            console.log('Running Hand Detection');
            const outputs2 = plugin2.model.runSync([resized]);
            const output = outputs2[0];

            // Parse keypoints from output (format: [y, x, confidence] for each point)
            // Hand model output structure is different. It has 21 landmarks * 3 coordinates = 63 values.
            // The output is just [x, y, z, x, y, z, ...] flattened.
            // Wait, the previous log said: Outputs: float32[1,63],float32[1,1],float32[1,1],float32[1,63]
            // So output[0] is the 63 floats.

            const numPoints = output.length / 3;
            const points = [];
            for (let i = 0; i < numPoints; i++) {
              // Hand landmarks are usually x, y, z.
              // We need to verify if it's x,y,z or y,x,z.
              // Usually MediaPipe is x, y, z.
              // And they are normalized [0, 1].

              // Let's assume x, y, z for now based on typical MediaPipe/TFLite hand models.
              // But the Pose model parsing above uses y, x, confidence.

              // Let's log the first point to see reasonable values.
              const val1 = parseFloat(String(output[i * 3]));
              const val2 = parseFloat(String(output[i * 3 + 1]));
              const val3 = parseFloat(String(output[i * 3 + 2]));

              // For now, let's map them as x, y, confidence=1 (since we don't have confidence score per point in this output tensor)
              // Or maybe the 4th output tensor is score?
              // The signature says: float32[1,63],float32[1,1],float32[1,1],float32[1,63]
              // The middle ones might be handedness and score.

              points.push({
                x: val1,
                y: val2,
                confidence: 1.0 // Placeholder
              });
            }
            updateKeypoints(points);
          } else {
            console.log('Hand model is not loaded');
          }
        }
      } catch (error) {
        console.error('Frame processor error:', error);
      }
    })
  }, [plugin, plugin2, resize, updateKeypoints])

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
  //   // console.log(`${frameWidth}x${frameHeight}`);
  //   // console.log(`${inputWidth}x${inputHeight}`)
  //   // console.log(output)

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
  // if (device == null) return <NoCameraDeviceError />

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  console.log('Keypoints:', JSON.stringify(keypoints, null, 2));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        pixelFormat="yuv"
        // enableBufferCompression={true}
        // videoStabilizationMode="off"
        // fps={30}
        frameProcessor={frameProcessor}
      />
      <Svg style={StyleSheet.absoluteFill}>
        {keypoints.map((point, index) => {
          if (point.confidence > MIN_CONFIDENCE) {
            return (
              <Circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={8}
                stroke="red"
                strokeWidth="2"
                fill="rgba(255, 0, 0, 0.3)"
              />
            );
          }
          return null;
        })}
      </Svg>
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
