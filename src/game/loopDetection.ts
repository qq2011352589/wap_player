/**
 * loopDetection - 页面循环检测。
 *
 * 连续同页面（周期 1）由 GameLoop 单独处理；
 * 本模块负责识别 A→B→A→B（周期 2）或 A→B→C→A→B→C（周期 3）这类交替循环。
 */

/** 返回检测到的循环周期（2..maxPeriod），否则 null。 */
export function detectUrlCycle(urls: readonly string[], maxPeriod = 3): number | null {
  for (let period = 2; period <= maxPeriod; period++) {
    if (urls.length < period * 2) continue;
    const tail = urls.slice(-period * 2);
    const first = tail.slice(0, period);
    const second = tail.slice(period);
    if (first.every((url, index) => url === second[index])) return period;
  }
  return null;
}
