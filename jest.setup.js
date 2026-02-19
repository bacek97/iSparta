global.__DEV__ = true;

// Jest setup file

// Mock react-native-get-random-values for Jest environment
jest.mock('react-native-get-random-values', () => {
    // Polyfill is already handled by Node's crypto.webcrypto
    return {};
});

// Mock crypto for Node environment
if (typeof global.crypto === 'undefined') {
    global.crypto = require('crypto').webcrypto;
}

const { NativeModules } = require('react-native');

// Mock NativeModules if not already mocked by react-native preset
if (!NativeModules.StepCounter) {
    NativeModules.StepCounter = {
        startStepCounter: jest.fn(),
        stopStepCounter: jest.fn(),
        addListener: jest.fn(),
        removeListeners: jest.fn(),
    };
}

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');

    // The mock for `call` immediately calls the callback which is incorrect
    // So we override it with a no-op
    Reanimated.default.call = () => { };

    return Reanimated;
});

// Silence the warning: Animated: `useNativeDriver` is not supported because the native animated module is missing
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({
    addListener: jest.fn(),
    removeListeners: jest.fn(),
}), { virtual: true });

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-geolocation-service
jest.mock('react-native-geolocation-service', () => ({
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
}));

// Mock @maplibre/maplibre-react-native
jest.mock('@maplibre/maplibre-react-native', () => ({
    MapView: 'MapView',
    Camera: 'Camera',
    UserLocation: 'UserLocation',
    ShapeSource: 'ShapeSource',
    LineLayer: 'LineLayer',
    SymbolLayer: 'SymbolLayer',
    CircleLayer: 'CircleLayer',
    Callout: 'Callout',
    PointAnnotation: 'PointAnnotation',
    MarkerView: 'MarkerView',
}));

// Mock @aakashsajjad/react-native-background-geolocation
jest.mock('@aakashsajjad/react-native-background-geolocation', () => ({
    ready: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onLocation: jest.fn(),
    onMotionChange: jest.fn(),
    onActivityChange: jest.fn(),
    onProviderChange: jest.fn(),
    removeListeners: jest.fn(),
    changePace: jest.fn(),
    setConfig: jest.fn(),
    BackgroundGeolocation: {
        ready: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        onLocation: jest.fn(),
        onMotionChange: jest.fn(),
        onActivityChange: jest.fn(),
        onProviderChange: jest.fn(),
        removeListeners: jest.fn(),
        changePace: jest.fn(),
        setConfig: jest.fn(),
    }
}));

// Mock @notifee/react-native for notifications
jest.mock('@notifee/react-native', () => ({
    createChannel: jest.fn(() => Promise.resolve()),
    displayNotification: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    AndroidImportance: { HIGH: 4 },
    AndroidVisibility: { PUBLIC: 1 },
    default: {
        createChannel: jest.fn(() => Promise.resolve()),
        displayNotification: jest.fn(() => Promise.resolve()),
        requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    },
}));
