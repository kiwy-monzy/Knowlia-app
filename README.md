# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

```sh
setx ANDROID_NDK_ROOT "C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066"
setx ANDROID_NDK "C:\Users\PC\AppData\Local\Android\Sdk\ndk\29.0.13846066"

# Rebuild the protobuf files - Run:
cd modules/libqaul && cargo build

# Build the tauri app - Run:
cd src-tauri && cargo build


# Step 1: Install the necessary dependencies.
pnpm i

# Step 2: Start the development server with auto-reloading and an instant preview.
pnpm tauri dev


#signer
pnpm tauri signer generate -w key/tabletopv1.key

git tag v0.1.0

git push origin v0.1.0

# Include the following in the release pipeline:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact: win-x64
          - os: windows-latest
            target: i686-pc-windows-msvc
            artifact: win-x86
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            artifact: linux-x64
          - os: macos-latest
            target: x86_64-apple-darwin
            artifact: macos-x64
          - os: macos-latest
            target: aarch64-apple-darwin
            artifact: macos-arm64


```            