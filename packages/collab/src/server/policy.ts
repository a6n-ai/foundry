/** Fixed window per key: `false` once the key exceeds `max` inside its window. */
export class RateWindow {
  private readonly windows = new Map<string, { start: number; count: number }>()
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now: number, cost = 1): boolean {
    let w = this.windows.get(key)
    if (!w || now - w.start > this.windowMs) {
      w = { start: now, count: 0 }
      this.windows.set(key, w)
    }
    w.count += cost
    return w.count <= this.max
  }
}

/** `true` the first time per key per window. */
export class Throttle {
  private readonly window: RateWindow
  constructor(windowMs: number) {
    this.window = new RateWindow(1, windowMs)
  }

  allow(key: string, now: number): boolean {
    return this.window.hit(key, now)
  }
}
