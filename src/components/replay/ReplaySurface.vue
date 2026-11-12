<script setup lang="ts">
import { computed, defineAsyncComponent, onErrorCaptured, ref } from 'vue'
import LightweightMap from './LightweightMap.vue'
import { useMissionStore } from '../../stores/mission'

// Do not import/evaluate Cesium or allocate a WebGL context until requested.
const FlightViewer = defineAsyncComponent(async () => (await import('./FlightViewer.vue')).default)
const use3d = ref(false), loading = ref(false), failure = ref('')
const store = useMissionStore()
const modeLabel = computed(() => use3d.value ? 'กลับแผนที่ 2D' : 'เปิดดาวเทียม 3D')
function switchMode() {
  if (!use3d.value) {
    store.mapStyle = 'satellite'
    store.showBasemap = true
    store.showTerrain = true
    store.terrainMode = 'regional'
    store.gisEffects = false
    store.showGroundGrid = false
    store.showAltitudeLines = false
    store.daylightPreview = true
    store.resetCamera()
  }
  use3d.value = !use3d.value; loading.value = use3d.value; failure.value = ''
}
onErrorCaptured(error => { failure.value = `เปิด 3D ไม่สำเร็จ: ${String(error)}`; use3d.value = false; loading.value = false; return false })
function recover2d(reason: string) { failure.value = reason; use3d.value = false; loading.value = false; store.playing = false }
</script>

<template>
  <div class="replay-surface">
    <div class="replay-mode-bar"><span>{{ use3d ? 'SATELLITE · 3D TERRAIN' : 'SATELLITE · 2D MAP' }}</span><button class="button" @click="switchMode">{{ modeLabel }}</button></div>
    <div class="replay-surface-content">
      <FlightViewer v-if="use3d" @vue:mounted="loading = false" @unavailable="recover2d"/>
      <LightweightMap v-else/>
      <p v-if="loading" class="map-message">กำลังโหลด Cesium… กลับแผนที่ 2D ได้ด้วยปุ่มด้านบน</p>
      <p v-if="failure" class="map-message" role="alert">{{ failure }}</p>
    </div>
  </div>
</template>

<style scoped>
.replay-surface{position:absolute;inset:0;display:flex;flex-direction:column;min-height:0;background:#0b1928}
.replay-mode-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border-bottom:1px solid #263d53;font:10px monospace;color:#7dc7dd;flex-shrink:0}
.replay-mode-bar .button{font-size:12px;padding:6px 10px}
.replay-surface-content{position:relative;flex:1;min-height:0}
.map-message{position:absolute;bottom:45px;left:15px;right:15px;background:#122438;padding:12px;color:#f1bd65;z-index:6}
</style>
