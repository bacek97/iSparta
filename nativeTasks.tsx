import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, NativeModules, Dimensions } from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
    VisionCameraProxy,
} from 'react-native-vision-camera';
import { NativeEventEmitter, View } from 'react-native';
import { Svg, Circle, Line } from 'react-native-svg';

const { HandLandmarks } = NativeModules;

console.log('[NativeTasks] HandLandmarks module:', HandLandmarks);

const handLandmarksEmitter = new NativeEventEmitter(HandLandmarks);

// Define hand landmark connections (MediaPipe hand model has 21 landmarks)
const lines: [number, number][] = [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index finger
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle finger
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring finger
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20],
    // Palm connections
    [5, 9], [9, 13], [13, 17],
];

// Initialize the frame processor plugin 'handLandmarks'
const handLandMarkPlugin = VisionCameraProxy.initFrameProcessorPlugin(
    'handLandmarks',
    {},
);

console.log('[NativeTasks] handLandMarkPlugin initialized:', handLandMarkPlugin);

type HandLandmark = {
    x: number;
    y: number;
    z: number;
    keypoint: number;
};

function HandCameraDemo() {
    const [landmarks, setLandmarks] = useState<HandLandmark[][]>([]);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();

    useEffect(() => {
        console.log('[NativeTasks] Setting up event listeners...');

        // Set up the event listener to listen for hand landmarks detection results
        const subscription = handLandmarksEmitter.addListener(
            'onHandLandmarksDetected',
            event => {
                console.log('[NativeTasks] onHandLandmarksDetected event received!');
                console.log('[NativeTasks] Number of hands:', event.landmarks?.length);

                // Update the landmarks state to render them on the screen
                setLandmarks(event.landmarks || []);
            },
        );

        const statusSubscription = handLandmarksEmitter.addListener(
            'onHandLandmarksStatus',
            event => {
                console.log('[NativeTasks] Status event:', JSON.stringify(event, null, 2));
            },
        );

        const errorSubscription = handLandmarksEmitter.addListener(
            'onHandLandmarksError',
            event => {
                console.error('[NativeTasks] ❌ ERROR EVENT ❌');
                console.error('[NativeTasks] Error event:', JSON.stringify(event, null, 2));
                console.error('[NativeTasks] Error message:', event.error);
            },
        );

        // Initialize the model
        console.log('[NativeTasks] Calling HandLandmarks.initModel()...');
        HandLandmarks.initModel();

        // Clean up the event listener when the component is unmounted
        return () => {
            console.log('[NativeTasks] Cleaning up event listeners');
            subscription.remove();
            statusSubscription.remove();
            errorSubscription.remove();
        };
    }, []);

    useEffect(() => {
        // Request camera permission on component mount
        console.log('[NativeTasks] Requesting camera permission...');
        requestPermission()
            .then(granted => console.log('[NativeTasks] Camera permission granted:', granted))
            .catch(error => console.error('[NativeTasks] Camera permission error:', error));
    }, [requestPermission]);

    const frameProcessor = useFrameProcessor(frame => {
        'worklet';

        // Process the frame using the 'handLandmarks' plugin
        try {
            if (handLandMarkPlugin != null) {
                handLandMarkPlugin.call(frame);
            }
        } catch (error) {
            console.error('[FrameProcessor] Error processing frame:', error);
        }
    }, []);

    if (!hasPermission) {
        console.log('[NativeTasks] No camera permission');
        return <Text>No permission</Text>;
    }

    if (device == null) {
        console.log('[NativeTasks] No camera device');
        return <Text>No device</Text>;
    }

    const pixelFormat = Platform.OS === 'ios' ? 'rgb' : 'yuv';
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;

    console.log('[NativeTasks] Rendering camera with device:', device.id);
    console.log('[NativeTasks] Current landmarks count:', landmarks.length);

    return (
        <View style={StyleSheet.absoluteFill}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
                pixelFormat={pixelFormat}
            />
            {landmarks.length > 0 && (
                <Svg style={StyleSheet.absoluteFill}>
                    {landmarks.map((hand, handIndex) => (
                        <React.Fragment key={`hand-${handIndex}`}>
                            {/* Draw lines connecting landmarks */}
                            {lines.map(([from, to], lineIndex) => {
                                if (hand[from] && hand[to]) {
                                    return (
                                        <Line
                                            key={`line-${handIndex}-${lineIndex}`}
                                            x1={hand[from].x * screenWidth}
                                            y1={hand[from].y * screenHeight}
                                            x2={hand[to].x * screenWidth}
                                            y2={hand[to].y * screenHeight}
                                            stroke="white"
                                            strokeWidth="2"
                                        />
                                    );
                                }
                                return null;
                            })}

                            {/* Draw circles on landmarks */}
                            {hand.map((mark, markIndex) => (
                                <Circle
                                    key={`circle-${handIndex}-${markIndex}`}
                                    cx={mark.x * screenWidth}
                                    cy={mark.y * screenHeight}
                                    r="6"
                                    fill="cyan"
                                />
                            ))}
                        </React.Fragment>
                    ))}
                </Svg>
            )}
        </View>
    );
}

export default HandCameraDemo;