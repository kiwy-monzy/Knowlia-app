#!/usr/bin/env pwsh
# Build script for Windows to avoid Android NDK interference

Write-Host "Clearing Android environment variables..." -ForegroundColor Yellow

# Clear Android-related environment variables
$env:ANDROID_HOME = ""
$env:ANDROID_SDK_ROOT = ""
$env:NDK_ROOT = ""

# Force CMake to use Windows/MSVC toolchain
$env:CMAKE_SYSTEM_NAME = "Windows"
$env:CC = "cl"
$env:CXX = "cl"

Write-Host "Building Tauri application with MSVC..." -ForegroundColor Green

# Run the dev command
pnpm run dev
