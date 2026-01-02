# Build Troubleshooting Guide

## Issue
The build fails with CMake incorrectly detecting Android NDK toolchain instead of MSVC, causing `aws-lc-sys` compilation errors.

## Root Cause
You have Android SDK/NDK environment variables set globally:
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `NDK_ROOT`

These cause CMake to prefer Android toolchains over MSVC.

## Solutions

### Solution 1: Use the Build Scripts (Quick Fix)
Run one of these instead of `pnpm run dev`:

**PowerShell (Recommended):**
```powershell
.\build-windows.ps1
```

**Windows Command Prompt:**
```batch
.\build-windows.bat
```

### Solution 2: Temporarily Remove Android Vars (Session-Only)
In your terminal, before building:

**PowerShell:**
```powershell
$env:ANDROID_HOME = ""
$env:ANDROID_SDK_ROOT = ""
$env:NDK_ROOT = ""
$env:CMAKE_SYSTEM_NAME = "Windows"
pnpm run dev
```

**Command Prompt:**
```batch
set ANDROID_HOME=
set ANDROID_SDK_ROOT=
set NDK_ROOT=
set CMAKE_SYSTEM_NAME=Windows
pnpm run dev
```

### Solution 3: Permanent Fix (Modify System Environment)
If you don't need Android development in this project:

1. Open **System Properties** → **Environment Variables**
2. **Temporarily rename** (don't delete) these variables:
   - `ANDROID_HOME` → `ANDROID_HOME_BACKUP`
   - `ANDROID_SDK_ROOT` → `ANDROID_SDK_ROOT_BACKUP`
   - `NDK_ROOT` → `NDK_ROOT_BACKUP`
3. Restart your terminal
4. Run `pnpm run dev`

You can restore them later when needed for Android projects.

### Solution 4: Use Cargo Environment Override
Create `.cargo/config.toml` in your project root with:

```toml
[env]
CMAKE_SYSTEM_NAME = "Windows"
```

⚠️ Note: This file is gitignored, so you'll need to recreate it after fresh clones.

## Verification
After applying any solution, you should see:
- CMake using MSVC compiler (not Android clang)
- `aws-lc-sys` compiling successfully
- Build proceeding normally

## Additional Notes
- The error occurs specifically with `aws-lc-sys` which is a transitive dependency
- This is a Windows-specific issue when multiple toolchains are present
- The Android toolchain is prioritized by CMake's default detection logic
