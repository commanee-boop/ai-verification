<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useMissionStore } from '../../stores/mission'
import { sortedTrack } from '../../utils/replay'
import { trailSegments } from '../../utils/trails'

const store = useMissionStore(), host = ref<HTMLElement>(), width = ref(800), height = ref(600)
const zoom = ref(9), center = ref({ longitude: 100.1, latitude: 15.12 }), failed = ref(false)
const basemap = ref<'satellite' | 'street'>('satellite')
let observer: ResizeObserver | undefined, drag: { id: number; x: number; y: number; cx: number; cy: number } | undefined
const worldSize = computed(() => 256 * 2 ** zoom.value)
function project(longitude: number, latitude: number) {
  const sin = Math.sin(Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180)
  return { x: (longitude + 180) / 360 * worldSize.value, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize.value }
}
function unproject(x: number, y: number) {
  return { longitude: ((x / worldSize.value * 360) % 360 + 360) % 360 - 180,
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * Math.max(0, Math.min(worldSize.value, y)) / worldSize.value))) * 180 / Math.PI }
}
const origin = computed(() => { const p = project(center.value.longitude, center.value.latitude); return { x: p.x - width.value / 2, y: p.y - height.value / 2 } })
function screen(longitude: number, latitude: number) { const p = project(longitude, latitude); return { x: p.x - origin.value.x, y: p.y - origin.value.y } }
const tiles = computed(() => {
  const result = [], count = 2 ** zoom.value, startX = Math.floor(origin.value.x / 256), startY = Math.floor(origin.value.y / 256)
  for (let y = startY; y <= Math.floor((origin.value.y + height.value) / 256); y++) for (let x = startX; x <= Math.floor((origin.value.x + width.value) / 256); x++) {
    if (y < 0 || y >= count) continue
    const wrapped = ((x % count) + count) % count
    const url = basemap.value === 'satellite'
      ? `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom.value}/${y}/${wrapped}`
      : `https://tile.openstreetmap.org/${zoom.value}/${wrapped}/${y}.png`
    result.push({ key: `${basemap.value}/${zoom.value}/${x}/${y}`, url, x: x * 256 - origin.value.x, y: y * 256 - origin.value.y })
  }
  return result
})
const paths = computed(() => store.showPaths ? store.mission.aircraft.flatMap(a => trailSegments(sortedTrack(store.mission.telemetry, a.id), store.currentTime - store.trailSeconds * 1000, store.currentTime).map((rows, i) => ({ key: `${a.id}-${i}`, color: a.color, points: rows.map(row => { const p = screen(row.longitude, row.latitude); return `${p.x},${p.y}` }).join(' ') }))) : [])
const aircraft = computed(() => store.aircraftStates.flatMap(s => s.sample ? [{ ...s, point: screen(s.sample.longitude, s.sample.latitude) }] : []))
function panStart(event: PointerEvent) {
  if (event.button !== 0) return
  const p = project(center.value.longitude, center.value.latitude)
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: p.x, cy: p.y }
  host.value?.setPointerCapture(event.pointerId)
}
function panMove(event: PointerEvent) { if (drag?.id === event.pointerId) center.value = unproject(drag.cx - event.clientX + drag.x, drag.cy - event.clientY + drag.y) }
function panEnd(event: PointerEvent) { if (drag?.id === event.pointerId) drag = undefined }
function changeZoom(delta: number) { zoom.value = Math.max(5, Math.min(14, zoom.value + delta)); failed.value = false }
function focusMission() {
  const sample = store.aircraftStates.find(s => s.sample)?.sample
  center.value = sample ? { longitude: sample.longitude, latitude: sample.latitude } : { longitude: 100.1, latitude: 15.12 }
  zoom.value = 10
}
onMounted(() => { observer = new ResizeObserver(([entry]) => { width.value = Math.max(1, entry.contentRect.width); height.value = Math.max(1, entry.contentRect.height) }); observer.observe(host.value!) })
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div ref="host" class="light-map" role="region" aria-label="แผนที่เที่ยวบิน 2D ลากเพื่อเลื่อน ใช้ปุ่มเพื่อซูม" @pointerdown="panStart" @pointermove="panMove" @pointerup="panEnd" @pointercancel="panEnd" @wheel.prevent="changeZoom($event.deltaY < 0 ? 1 : -1)">
    <div class="map-tiles" :class="{ 'map-tiles-street': basemap === 'street' }" aria-hidden="true"><img v-for="tile in tiles" :key="tile.key" :src="tile.url" :style="{ left: tile.x + 'px', top: tile.y + 'px' }" draggable="false" alt="" @error="failed = true"></div>
    <svg class="map-tracks" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true"><polyline v-for="path in paths" :key="path.key" :points="path.points" fill="none" :stroke="path.color" stroke-width="3"/><g v-for="s in aircraft" :key="s.aircraft.id" :transform="`translate(${s.point.x},${s.point.y})`"><circle r="7" :fill="s.aircraft.color" stroke="#fff" stroke-width="2"/><text v-if="store.showLabels" x="14" y="-10" :fill="s.aircraft.color" stroke="#081322" stroke-width="3" paint-order="stroke" font-size="13">{{ s.aircraft.callsign }}</text></g></svg>
    <div class="map-tools" @pointerdown.stop @wheel.stop><select v-model="basemap" aria-label="รูปแบบแผนที่" @change="failed = false"><option value="satellite">ดาวเทียม · Satellite</option><option value="street">ถนน · Dark Map</option></select><button class="button" aria-label="Zoom in" @click="changeZoom(1)">+</button><button class="button" aria-label="Zoom out" @click="changeZoom(-1)">−</button><button class="button" @click="focusMission">Mission</button><button class="button" @click="center = { longitude: 100.6, latitude: 14.7 }; zoom = 6">Thailand</button></div>
    <div class="map-note">แผนที่ 2D · ลากเพื่อเลื่อน / เลื่อนล้อเมาส์เพื่อซูม<span v-if="failed"> · โหลดแผนที่บางส่วนไม่ได้ ตรวจการเชื่อมต่ออินเทอร์เน็ต</span></div>
    <a v-if="basemap === 'satellite'" class="map-credit" href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener" @pointerdown.stop>Imagery © Esri, Vantor, Earthstar Geographics, GIS User Community</a>
    <a v-else class="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" @pointerdown.stop>© OpenStreetMap contributors</a>
  </div>
</template>

<style scoped>
.light-map{position:absolute;inset:0;overflow:hidden;background:#112234;touch-action:none;cursor:grab}.light-map:active{cursor:grabbing}
.map-tiles{position:absolute;inset:0}.map-tiles-street{filter:invert(.89) hue-rotate(175deg) saturate(.5) brightness(.82)}
.map-tiles img{position:absolute;width:256px;height:256px;max-width:none;user-select:none}
.map-tracks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.map-tools{position:absolute;left:12px;top:12px;display:flex;gap:5px;flex-wrap:wrap;right:12px}.map-tools .button{background:#112438;font-size:12px;padding:6px 10px}
.map-tools select{background:#112438;color:#d9e9f2;border:1px solid #294258;border-radius:5px;font-size:12px;padding:6px;max-width:100%}
.map-note{position:absolute;left:10px;bottom:28px;right:10px;font-size:11px;color:#bee0ed;background:#081322d9;padding:7px;pointer-events:none}
.map-credit{position:absolute;bottom:4px;right:8px;color:#add9e9;background:#081322d9;padding:2px 5px;font-size:10px}
</style>
