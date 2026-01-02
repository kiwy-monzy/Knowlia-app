import { platform } from "@tauri-apps/plugin-os";

// 异步检查是否为移动设备的函数
export function isMobileDevice() {
  if (typeof navigator !== "undefined") {
    return /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(navigator.userAgent);
  }
  return false;
}
