import { expect, it } from 'vitest'
import { renderBudgetExceeded } from '../src/utils/renderBudget'
const mb = 1024 ** 2
it('leaves headroom on small Chrome heaps and caps the app at 768 MiB on larger heaps', () => {
  expect(renderBudgetExceeded({ usedJSHeapSize: 300 * mb, jsHeapSizeLimit: 512 * mb })).toBe(false)
  expect(renderBudgetExceeded({ usedJSHeapSize: 310 * mb, jsHeapSizeLimit: 512 * mb })).toBe(true)
  expect(renderBudgetExceeded({ usedJSHeapSize: 769 * mb, jsHeapSizeLimit: 4096 * mb })).toBe(true)
})
it('handles browsers with missing or invalid heap metrics without throwing', () => {
  expect(renderBudgetExceeded()).toBe(false)
  expect(renderBudgetExceeded({ usedJSHeapSize: NaN, jsHeapSizeLimit: 0 })).toBe(false)
})
