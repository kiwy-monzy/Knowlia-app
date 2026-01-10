// Rate limiting utility to prevent excessive updates
export class RateLimiter {
  private lastUpdate: number = 0;
  private minInterval: number;

  constructor(minInterval: number = 1000) {
    this.minInterval = minInterval;
  }

  canUpdate(): boolean {
    const now = Date.now();
    if (now - this.lastUpdate >= this.minInterval) {
      this.lastUpdate = now;
      return true;
    }
    return false;
  }

  reset(): void {
    this.lastUpdate = 0;
  }
}

// Create a singleton instance for network updates
export const networkUpdateLimiter = new RateLimiter(500); // 500ms minimum interval between updates
