@echo off
echo Setting up Android development environment...

set ANDROID_NDK_ROOT=C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066
set ANDROID_NDK=C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066
set ANDROID_STANDALONE_TOOLCHAIN=C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066\toolchains\llvm\prebuilt\windows-x86_64

echo Environment variables set:
echo ANDROID_NDK_ROOT=%ANDROID_NDK_ROOT%
echo ANDROID_NDK=%ANDROID_NDK%
echo ANDROID_STANDALONE_TOOLCHAIN=%ANDROID_STANDALONE_TOOLCHAIN%

echo.
echo Starting Android development...
npx tauri android dev
