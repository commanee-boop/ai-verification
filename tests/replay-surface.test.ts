// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onUnmounted } from 'vue'
import { createPinia } from 'pinia'
import ReplaySurface from '../src/components/replay/ReplaySurface.vue'
import { useMissionStore } from '../src/stores/mission'

const lifecycle = vi.hoisted(() => ({ loads: 0, unmounts: 0 }))
vi.mock('../src/components/replay/FlightViewer.vue', () => {
  lifecycle.loads++
  return { default: defineComponent({ emits: ['unavailable'], setup(_, { emit }) { onUnmounted(() => lifecycle.unmounts++); return () => h('button', { class: 'mock-render-failure', onClick: () => emit('unavailable', 'WebGL context lost') }, '3D viewer') } }) }
})
afterEach(() => vi.unstubAllGlobals())
it('keeps Cesium unloaded on startup and unmounts it when returning to 2D', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host = document.createElement('div'); document.body.append(host)
  const pinia = createPinia(), app = createApp(ReplaySurface).use(pinia); app.mount(host)
  const store = useMissionStore(pinia)
  try {
    expect(lifecycle.loads).toBe(0)
    expect(host.querySelectorAll('.map-tiles img').length).toBeGreaterThan(0)
    const toggle = host.querySelector<HTMLButtonElement>('.replay-mode-bar button')!
    toggle.click()
    await vi.waitFor(() => expect(host.textContent).toContain('3D viewer'))
    expect(lifecycle.loads).toBe(1)
    expect(store.mapStyle).toBe('satellite')
    expect(store.showTerrain).toBe(true)
    expect(store.terrainMode).toBe('regional')
    expect(store.gisEffects).toBe(false)
    expect(store.showAltitudeLines).toBe(false)
    expect(store.showGroundGrid).toBe(false)
    expect(store.daylightPreview).toBe(true)
    toggle.click(); await nextTick()
    expect(lifecycle.unmounts).toBe(1)
    expect(host.querySelector('.light-map')).not.toBeNull()
    toggle.click()
    await vi.waitFor(() => expect(host.querySelector('.mock-render-failure')).not.toBeNull())
    store.playing = true
    host.querySelector<HTMLButtonElement>('.mock-render-failure')!.click(); await nextTick()
    expect(store.playing).toBe(false)
    expect(lifecycle.unmounts).toBe(2)
    expect(host.querySelector('.light-map')).not.toBeNull()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('WebGL context lost')
  } finally { app.unmount(); host.remove() }
})
