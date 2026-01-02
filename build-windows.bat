@echo off
echo ========================================
echo Tauri Build Script (Windows/MSVC)
echo ========================================
echo.
echo [1/3] Clearing Android environment variables...
set "ANDROID_HOME="
set "ANDROID_SDK_ROOT="
set "NDK_ROOT="
echo.
echo [2/3] Setting MSVC as the preferred compiler...
set "CMAKE_SYSTEM_NAME=Windows"
set "CC=cl"
set "CXX=cl"
echo.
echo [3/3] Starting build...
echo.
pnpm run dev
