export interface AutoRefreshOptions {
  enabled: boolean;
  intervalSeconds: number;
  onRefresh: () => Promise<void> | void;
}

export class AutoRefreshManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private options: AutoRefreshOptions;

  constructor(options: AutoRefreshOptions) {
    this.options = { ...options };
  }

  start(): void {
    this.stop();

    if (this.options.enabled && this.options.intervalSeconds > 0) {
      this.timer = setInterval(
        this.options.onRefresh,
        this.options.intervalSeconds * 1000,
      );
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateOptions(options: Partial<AutoRefreshOptions>): void {
    this.options = { ...this.options, ...options };
    this.start(); // Restart with new options
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  destroy(): void {
    this.stop();
  }
}

export function createAutoRefresh(
  options: AutoRefreshOptions,
): AutoRefreshManager {
  console.log("Creating auto-refresh");
  const manager = new AutoRefreshManager(options);

  return manager;
}
