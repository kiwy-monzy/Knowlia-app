import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from '@tauri-apps/api/path';
import { getWorkspacePath } from "./workspace";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export async function convertImage(path: string) {
  const appDataDirPath = await appDataDir()
  const imagePath = appDataDirPath + path
  return convertFileSrc(imagePath)
}

export async function convertImageByWorkspace(path: string) {
  const workspace = await getWorkspacePath()
  if (workspace.isCustom) {
    path = `${workspace.path}/${path}`
  } else {
    path = `${await appDataDir()}/article/${path}`
  }
  return convertFileSrc(path)
}

export function convertBytesToSize(bytes: number) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) {
    return '0 Bytes';
  }
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
}

export function arrayBuffer2String(buffer: ArrayBuffer) {
  const decoder = new TextDecoder('iso-8859-1');
  return decoder.decode(buffer);
}

export function scrollToBottom() {
  const container = document.querySelector('.flex-1.overflow-y-auto')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}