/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useEffect, useState } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';

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
  const [hasPermission, setHasPermission] = useState(false)
  const [plugin, setPlugin] = useState<{ model: TensorflowModel | null }>({ model: null })

  useEffect(() => {
    Camera.requestCameraPermission().then((p) =>
      setHasPermission(p === 'granted')
    )
  }, [])

  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log('Loading TFLite model...');
        const model = await loadTensorflowModel(
          require('./models_tflite/singlepose-lightning-tflite-int8-1-4.tflite'),
          'nnapi' // Android Neural Networks API - good balance of performance and compatibility
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

    loadModel();
  }, [])

  const device = useCameraDevice('front')
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
    if (plugin.model != null) {
      try {
        const resized = resize(frame, {
          scale: {
            width: inputWidth,
            height: inputHeight,
          },
          pixelFormat: 'rgb',
          dataType: 'uint8',
          rotation: '0deg',
        });
        // resize(frame, 192, 192)
        const outputs = plugin.model.runSync([resized])
        // console.log(`Received ${outputs.length} outputs!`)
        console.log(outputs)
      } catch (error) {
        console.error('Frame processor error:', error);
      }
    }
  }, [plugin, inputWidth, inputHeight])

  if (!hasPermission) return <App2 />
  // if (device == null) return <NoCameraDeviceError />
  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      pixelFormat="rgb"
      frameProcessor={frameProcessor}
    />
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
