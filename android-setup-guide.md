# Android Development Setup Guide

## Current Status

- Android NDK is installed at: `C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066`
- Environment variables are set but CMake is not recognizing them properly

## Solution Options

### Option 1: Use Android Studio (Recommended)

1. Open Android Studio
2. Go to **Tools > SDK Manager > SDK Tools**
3. Ensure **NDK (Side by side)** is installed
4. Use Android Studio to build and run the app

### Option 2: Fix Environment Variables

Run these commands in a new terminal:

```cmd
setx ANDROID_NDK_ROOT "C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066" /M
setx ANDROID_NDK "C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066" /M
setx ANDROID_STANDALONE_TOOLCHAIN "C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066\toolchains\llvm\prebuilt\windows-x86_64" /M
```

Then restart your terminal and IDE.

### Option 3: Use Gradle Directly

```cmd
cd src-tauri
cargo tauri android build
```

## Current Workaround

Focus on Windows desktop development for now. The timetable integration is fully functional on desktop.

## Next Steps

1. Test Windows desktop version
2. Resolve Android setup later with proper NDK configuration
