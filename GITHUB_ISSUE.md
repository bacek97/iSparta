# NullPointerException in BackgroundGeolocationModule.onHostResume() due to race condition in Logger initialization

## Environment

- **Package**: `@aakashsajjad/react-native-background-geolocation@^0.7.12`
- **React Native**: 0.76.x (Bridgeless/New Architecture)
- **Platform**: Android
- **Device**: Samsung Galaxy (Android 12)

## Description

The app crashes intermittently on startup with a `NullPointerException` when `BackgroundGeolocationModule.onHostResume()` is called. The issue occurs because the `logger` field is sometimes `null` due to a race condition in the `LoggerManager` static initialization block.

## Steps to Reproduce

1. Install the package: `npm install @aakashsajjad/react-native-background-geolocation`
2. Build and install the app: `npm run android`
3. Force-stop the app: `adb shell am force-stop <package>`
4. Launch the app: `adb shell am start -n <package>/.MainActivity`
5. Repeat steps 3-4 multiple times (the crash is intermittent due to race condition)

**Result**: App crashes ~50% of the time with the error below.

## Error Log

```
E AndroidRuntime: FATAL EXCEPTION: main
E AndroidRuntime: Process: com.isparta, PID: 16603
E AndroidRuntime: java.lang.RuntimeException: Unable to resume activity {com.isparta/com.isparta.MainActivity}: 
  java.lang.NullPointerException: Attempt to invoke interface method 'void org.slf4j.Logger.info(java.lang.String)' 
  on a null object reference
E AndroidRuntime:     at android.app.ActivityThread.performResumeActivity(ActivityThread.java:4657)
E AndroidRuntime:     at android.app.ActivityThread.handleResumeActivity(ActivityThread.java:4690)
E AndroidRuntime:     ...
E AndroidRuntime: Caused by: java.lang.NullPointerException: Attempt to invoke interface method 
  'void org.slf4j.Logger.info(java.lang.String)' on a null object reference
E AndroidRuntime:     at com.marianhello.bgloc.react.BackgroundGeolocationModule.onHostResume(BackgroundGeolocationModule.java:107)
E AndroidRuntime:     at com.facebook.react.bridge.ReactContext.onHostResume(ReactContext.java:255)
```

## Root Cause

The issue is in `LoggerManager.java` static initialization block:

```java
static {
    LoggerContext context = (LoggerContext) org.slf4j.LoggerFactory.getILoggerFactory();
    context.reset();
    // ... configuration
}
```

When `BackgroundGeolocationModule` is instantiated, it calls:

```java
logger = LoggerManager.getLogger(BackgroundGeolocationModule.class);
```

Due to timing issues, `LoggerFactory.getILoggerFactory()` sometimes returns `null` or an uninitialized context during the static block execution, causing `LoggerManager.getLogger()` to return `null`. Later, when `onHostResume()` is called:

```java
@Override
public void onHostResume() {
    logger.info("App will be resumed"); // <- NullPointerException here
    facade.resume();
    sendEvent(FOREGROUND_EVENT, null);
}
```

The app crashes because `logger` is `null`.

## Proposed Solution

Add defensive null-checks before all logger calls in `BackgroundGeolocationModule.java`:

```java
@Override
public void onHostResume() {
    if (logger != null) {
        logger.info("App will be resumed");
    }
    facade.resume();
    sendEvent(FOREGROUND_EVENT, null);
}
```

This should be applied to all methods that use `logger`:
- Line 107: `onHostResume()`
- Line 117: `onHostPause()`
- Line 128: `onHostDestroy()`
- Line 136: `onCatalystInstanceDestroy()`
- Line 171, 174: `configure()`
- Line 315: `checkStatus()`
- Line 324: `registerHeadlessTask()`
- Line 341: `sendEvent()`

Since logging is not essential for the module's functionality, gracefully handling null logger won't affect the app behavior.

## Workaround

As a temporary workaround, force SLF4J initialization in your app's `Application.onCreate()`:

```kotlin
override fun onCreate() {
    super.onCreate()
    
    // Force SLF4J initialization before React Native loads
    try {
        org.slf4j.LoggerFactory.getILoggerFactory()
    } catch (e: Exception) {
        android.util.Log.e("App", "Failed to init SLF4J", e)
    }
    
    loadReactNative(this)
}
```

This reduces the crash rate but doesn't eliminate it completely.

## Additional Context

- This issue is more prominent with React Native's new architecture (Bridgeless mode)
- The crash is intermittent, making it difficult to reproduce consistently
- When the app starts successfully, the logger works fine - this confirms it's a race condition
