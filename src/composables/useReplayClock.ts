import { onMounted, onUnmounted } from 'vue'
import { useMissionStore } from '../stores/mission'
export function useReplayClock() {
  const store = useMissionStore(); let frame = 0, previous = 0
  function tick(time: number) { if (previous && store.playing) { store.seek(store.currentTime + Math.min(time - previous, 250) * store.speed); if (store.currentTime >= store.end) store.playing = false } previous = time; frame = requestAnimationFrame(tick) }
  onMounted(() => frame = requestAnimationFrame(tick)); onUnmounted(() => cancelAnimationFrame(frame))
}
