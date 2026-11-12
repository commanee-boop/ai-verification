interface HeapMemory { usedJSHeapSize: number; jsHeapSizeLimit: number }
/** Chrome's heap signal is advisory; GPU memory and renderer crashes cannot be caught here. */
export function renderBudgetExceeded(memory?: HeapMemory) {
  if (!memory || !Number.isFinite(memory.usedJSHeapSize) || !Number.isFinite(memory.jsHeapSizeLimit) || memory.jsHeapSizeLimit <= 0) return false
  return memory.usedJSHeapSize > Math.min(768 * 1024 ** 2, memory.jsHeapSizeLimit * 0.6)
}
