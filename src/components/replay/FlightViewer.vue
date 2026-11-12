<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Viewer, Cartesian2, Cartesian3, Cartographic, Color, Entity, ConstantPositionProperty,
  ConstantProperty, HeadingPitchRoll, Transforms, Math as CMath, HeadingPitchRange,
  BoundingSphere, Matrix4, Ellipsoid, EllipsoidTerrainProvider, HeightReference,
  PolylineGlowMaterialProperty, PolylineDashMaterialProperty, ScreenSpaceEventHandler,
  ScreenSpaceEventType, ArcType, LabelStyle, NearFarScalar, ShadowMode,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useMissionStore } from '../../stores/mission'
import { durationLabel, sortedTrack } from '../../utils/replay'
import { interval, validCoordinate } from '../../utils/quality'
import { trailSegments } from '../../utils/trails'
import { createMapImagery, createTerrainSource, groundReferenceHeight, mapLabels, worldTerrainConfigured } from '../../services/mapService'
import { configureGisScene, thailandCamera } from '../../services/gisScene'
import type { AircraftTelemetry } from '../../types'
import Icon from '../common/AppIcon.vue'
import { renderBudgetExceeded } from '../../utils/renderBudget'

const emit = defineEmits<{ unavailable: [reason: string] }>()
const store = useMissionStore(), container = ref<HTMLElement>(), error = ref(''), ready = ref(false)
const expanded = ref(false), cameraHeading = ref(0), gridSpacing = ref(2000), mapLoading = ref(false)
const shell = ref<HTMLElement>(), overlayHeader = ref<HTMLElement>(), transport = ref<HTMLElement>()
const headerHeight = ref(72), footerHeight = ref(0)
let hudObserver: ResizeObserver | undefined, savedBodyOverflow: string | undefined, previousFocus: HTMLElement | null = null
function measureHud() { headerHeight.value = Math.ceil(overlayHeader.value?.getBoundingClientRect().height || 72); footerHeight.value = Math.ceil(transport.value?.getBoundingClientRect().height || 0) }
function observeHud() { hudObserver?.disconnect(); if (overlayHeader.value) hudObserver?.observe(overlayHeader.value); if (transport.value) hudObserver?.observe(transport.value); measureHud() }
function restoreBodyScroll() { if (savedBodyOverflow !== undefined) { document.body.style.overflow = savedBodyOverflow; savedBodyOverflow = undefined } }
watch(expanded, async value => {
  if (value) { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; savedBodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  else restoreBodyScroll()
  await nextTick(); observeHud(); viewer?.resize()
  if (value) shell.value?.focus({ preventScroll: true })
  else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
const selectedAircraft = computed(() => store.mission.aircraft.find(a => a.id === store.selectedAircraftId))
const selectedState = computed(() => store.aircraftStates.find(s => s.aircraft.id === store.selectedAircraftId))
let viewer: Viewer | undefined, observer: ResizeObserver | undefined, inputHandler: ScreenSpaceEventHandler | undefined
let removePostRender: (() => void) | undefined, removeRenderError: (() => void) | undefined
let memoryTimer: ReturnType<typeof setInterval> | undefined, replayTimer: ReturnType<typeof setTimeout> | undefined
let removeContextLost: (() => void) | undefined
const terrainLoading = ref(false), terrainActive = ref(false), terrainTilesPending = ref(0), mapStatus = ref('Loading satellite imagery…'), terrainStatus = ref('Loading regional elevation…')
let gisScene: ReturnType<typeof configureGisScene> | undefined
let mapRevision = 0, terrainRevision = 0
let removeImageryError: (() => void) | undefined, removeTerrainError: (() => void) | undefined, removeTileProgress: (() => void) | undefined
let terrainProvider: Awaited<ReturnType<typeof createTerrainSource>> | undefined, terrainCacheMode = ''
let gridEntities: Entity[] = [], routeEntities: Entity[] = []
interface FlightObjects { aircraft: Entity; stalk: Entity; footprint: Entity; trails: Entity[]; projections: Entity[]; rows: AircraftTelemetry[]; cadence: number; groundKey?: string }
const flights = new Map<string, FlightObjects>()
const color = (hex: string) => Color.fromCssColorString(hex)
const world = (t: AircraftTelemetry, ground = false) => Cartesian3.fromDegrees(t.longitude, t.latitude, ground ? 5 : t.altitude)
function stop3d(reason: string) {
  if (viewer && !viewer.isDestroyed()) viewer.useDefaultRenderLoop = false
  emit('unavailable', reason)
}
function checkMemory() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  if (renderBudgetExceeded(memory)) { stop3d('หยุด 3D เพราะหน่วยความจำสูง กลับมาใช้แผนที่ดาวเทียม 2D แล้ว'); return false }
  return true
}
function scheduleReplayUpdate() {
  if (replayTimer) return
  // Coalesce the replay clock into at most ten geometry updates per second.
  replayTimer = setTimeout(() => { replayTimer = undefined; gisScene?.syncSun(store.currentTime, store.daylightPreview); updatePositions(); viewer?.scene.requestRender() }, 100)
}

function makeLine(positions: Cartesian3[], tint: Color, width = 1, dashed = false) {
  return viewer!.entities.add({ polyline: { positions, width, arcType: ArcType.NONE, material: dashed ? new PolylineDashMaterialProperty({ color: tint, dashLength: 10 }) : tint } })
}
function buildGroundGrid() {
  const points = store.mission.telemetry.filter(validCoordinate).map(t => world(t))
  if (!points.length || !viewer) return
  const sphere = BoundingSphere.fromPoints(points), center = Cartographic.fromCartesian(sphere.center)
  const origin = Cartesian3.fromRadians(center.longitude, center.latitude, 0)
  const transform = Transforms.eastNorthUpToFixedFrame(origin)
  // Local metric grid, projected to the WGS84 reference ellipsoid. Not terrain.
  const extent = Math.max(10000, sphere.radius * 1.6)
  const step = extent > 100000 ? 20000 : extent > 30000 ? 10000 : 2000
  gridSpacing.value = step
  const size = Math.ceil(extent / step) * step
  const ground = (x: number, y: number) => { const p = Ellipsoid.WGS84.scaleToGeodeticSurface(Matrix4.multiplyByPoint(transform, new Cartesian3(x, y, 0), new Cartesian3()))!; const c = Cartographic.fromCartesian(p); return Cartesian3.fromRadians(c.longitude, c.latitude, 5) }
  for (let offset = -size; offset <= size; offset += step) {
    const major = offset % (step * 5) === 0
    const tint = color(major ? '#769a7c' : '#587b66').withAlpha(major ? 0.48 : 0.2)
    gridEntities.push(makeLine([ground(offset, -size), ground(offset, size)], tint, major ? 1.2 : 1))
    gridEntities.push(makeLine([ground(-size, offset), ground(size, offset)], tint, major ? 1.2 : 1))
  }
  for (const [text, x, y] of [['N', 0, size], ['E', size, 0]] as const) gridEntities.push(viewer.entities.add({ position: ground(x, y), label: { text, font: 'bold 16px sans-serif', fillColor: color('#b4c9b7'), style: LabelStyle.FILL_AND_OUTLINE, outlineColor: color('#101a20'), outlineWidth: 3 } }))
  gridEntities.forEach(e => { e.show = store.showGroundGrid; if (e.polyline) { e.polyline.arcType = new ConstantProperty(ArcType.GEODESIC); e.polyline.granularity = new ConstantProperty(CMath.toRadians(0.01)); e.polyline.clampToGround = new ConstantProperty(terrainActive.value) } if (e.label) e.label.heightReference = new ConstantProperty(HeightReference.CLAMP_TO_GROUND) })
}

function updateTrails(f: FlightObjects, tint: Color) {
  const segments = store.showPaths ? trailSegments(f.rows, store.currentTime - store.trailSeconds * 1000, store.currentTime, f.cadence) : []
  segments.forEach((segment, i) => {
    if (!f.trails[i]) f.trails.push(viewer!.entities.add({ polyline: { positions: [], width: 3, arcType: ArcType.NONE, material: new PolylineGlowMaterialProperty({ color: tint, glowPower: 0.12, taperPower: 0.9 }) } }))
    f.trails[i].show = true
    f.trails[i].polyline!.positions = new ConstantProperty(segment.map(t => world(t)))
    if (store.showAltitudeLines) {
      if (!f.projections[i]) { const line = makeLine([], tint.withAlpha(0.26), 1, true); line.polyline!.arcType = new ConstantProperty(ArcType.GEODESIC); f.projections[i] = line }
      f.projections[i].show = true
      f.projections[i].polyline!.clampToGround = new ConstantProperty(terrainActive.value)
      f.projections[i].polyline!.positions = new ConstantProperty(segment.map(t => world(t, true)))
    }
  })
  f.trails.forEach((e, i) => { if (i >= segments.length) e.show = false })
  f.projections.forEach((e, i) => { if (i >= segments.length || !store.showAltitudeLines) e.show = false })
}

function updateGround(f: FlightObjects, s: AircraftTelemetry) {
  const terrainHeight = groundReferenceHeight(terrainActive.value, viewer!.scene.globe.getHeight(Cartographic.fromDegrees(s.longitude, s.latitude)))
  const show = store.showAltitudeLines && terrainHeight !== undefined
  f.stalk.show = show; f.footprint.show = show
  if (!show) { f.groundKey = undefined; return }
  const key = `${s.longitude}/${s.latitude}/${s.altitude}/${terrainHeight}`
  if (f.groundKey === key) return
  f.groundKey = key
  const ground = Cartesian3.fromDegrees(s.longitude, s.latitude, terrainHeight! + 5)
  f.stalk.polyline!.positions = new ConstantProperty([ground, world(s)])
  f.footprint.position = new ConstantPositionProperty(ground)
  f.footprint.ellipse!.height = new ConstantProperty(terrainHeight! + 2)
}

function updatePositions() {
  if (!viewer) return
  for (const state of store.aircraftStates) {
    const f = flights.get(state.aircraft.id)
    if (!f) continue
    const s = state.sample, tint = color(state.aircraft.color), selected = state.aircraft.id === store.selectedAircraftId
    f.aircraft.show = !!s; f.stalk.show = !!s && store.showAltitudeLines; f.footprint.show = !!s && store.showAltitudeLines
    if (s) {
      const p = world(s)
      updateGround(f, s)
      const hasAttitude = s.heading !== undefined && s.pitch !== undefined && s.roll !== undefined
      f.aircraft.position = new ConstantPositionProperty(p)
      f.aircraft.orientation = new ConstantProperty(Transforms.headingPitchRollQuaternion(p, new HeadingPitchRoll(CMath.toRadians((s.heading || 0) - 90), CMath.toRadians(s.pitch || 0), CMath.toRadians(s.roll || 0))))
      f.aircraft.model!.show = new ConstantProperty(hasAttitude)
      f.aircraft.model!.silhouetteSize = new ConstantProperty(0)
      f.aircraft.point!.show = new ConstantProperty(!hasAttitude)
      f.aircraft.point!.pixelSize = new ConstantProperty(selected ? 12 : 9)
      f.aircraft.label!.show = new ConstantProperty(store.showLabels)
      f.aircraft.label!.text = new ConstantProperty(`${state.aircraft.callsign}  [${state.aircraft.id}]\n${Math.round(s.altitude).toLocaleString()} m  |  ${s.heading === undefined ? 'HDG N/A' : ((s.heading % 360 + 360) % 360).toFixed(0) + '°'}\n${hasAttitude ? '' : 'ATTITUDE N/A · '}${s.interpolated ? 'INTERPOLATED' : 'RECORDED SAMPLE'}`)
    }
    updateTrails(f, tint)
  }
}

function rebuild() {
  if (!viewer) return
  viewer.trackedEntity = undefined; viewer.entities.removeAll(); flights.clear(); gridEntities = []; routeEntities = []
  if (store.showGroundGrid) buildGroundGrid()
  for (const a of store.mission.aircraft) {
    const rows = sortedTrack(store.mission.telemetry, a.id), cadence = interval(rows), tint = color(a.color)
    if (rows.length) for (const segment of trailSegments(rows, Date.parse(rows[0].timestamp), Date.parse(rows.at(-1)!.timestamp), cadence)) {
      const line = makeLine(segment.map(t => world(t)), tint.withAlpha(0.18), 1)
      line.show = store.showRecordedRoute && store.showPaths; routeEntities.push(line)
    }
    const aircraft = viewer.entities.add({ id: `aircraft-${a.id}`, name: a.callsign,
      model: { uri: '/models/aircraft.gltf', minimumPixelSize: 52, maximumScale: 500, color: tint, silhouetteColor: tint, silhouetteSize: 1, shadows: ShadowMode.DISABLED },
      point: { pixelSize: 10, color: tint, outlineColor: color('#e5edf3'), outlineWidth: 2, disableDepthTestDistance: Infinity },
      viewFrom: new Cartesian3(-5000, -7000, 4000),
      label: { text: a.callsign, font: '11px monospace', fillColor: tint, style: LabelStyle.FILL_AND_OUTLINE, outlineColor: color('#081322'), outlineWidth: 3, showBackground: true, backgroundColor: color('#081322').withAlpha(0.8), backgroundPadding: new Cartesian2(8, 6), pixelOffset: new Cartesian2(75, -35), scaleByDistance: new NearFarScalar(1000, 1, 150000, 0.75), disableDepthTestDistance: Infinity },
    })
    const stalk = makeLine([], tint.withAlpha(0.65), 1, true)
    const footprint = viewer.entities.add({ ellipse: { semiMajorAxis: 180, semiMinorAxis: 180, height: 0, material: tint.withAlpha(0.13), outline: true, outlineColor: tint.withAlpha(0.7) } })
    flights.set(a.id, { aircraft, stalk, footprint, rows, cadence, trails: [], projections: [] })
  }
  updatePositions(); setCamera()
}

function setCamera() {
  if (!viewer) return
  viewer.trackedEntity = undefined
  if (flights.has(store.cameraMode)) { viewer.trackedEntity = flights.get(store.cameraMode)!.aircraft; return }
  if (store.cameraMode === 'free') return
  if (store.cameraMode === 'thailand') {
    viewer.camera.lookAt(Cartesian3.fromDegrees(thailandCamera.longitude, thailandCamera.latitude), new HeadingPitchRange(CMath.toRadians(thailandCamera.heading), CMath.toRadians(thailandCamera.pitch), thailandCamera.range))
    return
  }
  const points = store.mission.telemetry.filter(validCoordinate).map(t => world(t))
  if (!points.length) { viewer.camera.setView({ destination: Cartesian3.fromDegrees(100.1, 15.1, 100000) }); return }
  const sphere = BoundingSphere.fromPoints(points), range = Math.max(18000, sphere.radius * 2.8)
  viewer.camera.lookAt(sphere.center, new HeadingPitchRange(CMath.toRadians(store.cameraMode === 'side' ? 90 : 25), CMath.toRadians(store.cameraMode === 'top' ? -89.9 : store.cameraMode === 'side' ? -9 : -28), range))
}

async function updateBasemap() {
  if (!viewer) return
  const activeViewer = viewer, revision = ++mapRevision, style = store.mapStyle
  removeImageryError?.(); removeImageryError = undefined
  if (!store.showBasemap) { activeViewer.imageryLayers.removeAll(); mapStatus.value = 'Analysis grid · no imagery'; mapLoading.value = false; return }
  mapLoading.value = true
  mapStatus.value = `Loading ${mapLabels[style]}…`
  try {
    const provider = await createMapImagery(style)
    if (viewer !== activeViewer || activeViewer.isDestroyed() || revision !== mapRevision) return
    activeViewer.imageryLayers.removeAll()
    const layer = activeViewer.imageryLayers.addImageryProvider(provider); layer.brightness = 1; layer.saturation = 1
    mapStatus.value = mapLabels[style]
    let tileErrors = 0
    removeImageryError = provider.errorEvent.addEventListener(() => { if (revision !== mapRevision || ++tileErrors < 3) return; removeImageryError?.(); removeImageryError = undefined; fallbackMap(style) })
  } catch { if (revision === mapRevision && viewer === activeViewer) fallbackMap(style) }
  finally { if (revision === mapRevision) mapLoading.value = false }
}

function fallbackMap(failedStyle: string) {
  const next = failedStyle === 'dark' ? 'satellite' : failedStyle === 'satellite' ? 'street' : failedStyle === 'street' ? 'offline' : undefined
  store.notify(`${failedStyle} imagery unavailable. ${next ? `Switching to ${next}.` : 'Using analysis view.'}`, true)
  if (next) store.mapStyle = next
  else { store.showBasemap = false; store.showGroundGrid = true }
}
function refreshGroundReferences() {
  gridEntities.forEach(e => { if (e.polyline) e.polyline.clampToGround = new ConstantProperty(terrainActive.value) })
  updatePositions()
}
async function updateTerrain() {
  if (!viewer) return
  const activeViewer = viewer, revision = ++terrainRevision, mode = store.terrainMode
  removeTerrainError?.(); removeTerrainError = undefined
  terrainLoading.value = false
  if (!store.showTerrain) { activeViewer.terrainProvider = new EllipsoidTerrainProvider(); terrainActive.value = false; terrainStatus.value = 'Reference ellipsoid · 3D terrain off'; refreshGroundReferences(); return }
  terrainLoading.value = true; terrainStatus.value = 'Loading regional elevation…'
  try {
    const selection = terrainProvider && terrainCacheMode === mode ? terrainProvider : await createTerrainSource(mode)
    if (viewer !== activeViewer || activeViewer.isDestroyed() || revision !== terrainRevision) return
    terrainProvider = selection; terrainCacheMode = mode
    activeViewer.terrainProvider = terrainProvider.provider
    terrainActive.value = true
    terrainStatus.value = `${terrainProvider.label} · ${terrainProvider.waterMask ? 'water mask' : 'no water mask'} · ${terrainProvider.vertexNormals ? 'vertex normals' : 'no vertex normals'}${terrainProvider.fallbackReason ? ' · ' + terrainProvider.fallbackReason : ''}`
    if (terrainProvider.fallbackReason) store.notify(`${terrainProvider.fallbackReason}. Using Esri terrain; World Terrain water effects are unavailable.`, true)
    let tileErrors = 0
    removeTerrainError = terrainProvider.provider.errorEvent.addEventListener(() => { if (revision !== terrainRevision || ++tileErrors < 3) return; terrainProvider = undefined; store.notify('Terrain tiles unavailable. Returning to the reference ellipsoid.', true); store.showTerrain = false })
    refreshGroundReferences()
  } catch { if (revision === terrainRevision && viewer === activeViewer) { store.showTerrain = false; store.notify('3D terrain unavailable. Imagery remains available on the reference ellipsoid.', true) } }
  finally { if (revision === terrainRevision) terrainLoading.value = false }
}

function togglePlay() { if (!store.duration) return; if (store.currentTime >= store.end) store.seek(store.start); store.playing = !store.playing }
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') { expanded.value = false; return }
  if ((event.target as HTMLElement).matches('input, select, button')) return
  if (event.code === 'Space') { event.preventDefault(); togglePlay() }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); store.seek(store.currentTime + (event.key === 'ArrowLeft' ? -5000 : 5000)) }
}
function escapeExpanded(event: KeyboardEvent) { if (event.key === 'Escape') expanded.value = false }

onMounted(() => {
  window.addEventListener('keydown', escapeExpanded)
  hudObserver = new ResizeObserver(measureHud); observeHud()
  try {
    if (!checkMemory()) return
    viewer = new Viewer(container.value!, { baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, shouldAnimate: false, requestRenderMode: true, maximumRenderTimeChange: Infinity, msaaSamples: 1, scene3DOnly: true, skyBox: false, skyAtmosphere: false, orderIndependentTranslucency: false, contextOptions: { webgl: { antialias: false, alpha: false, powerPreference: 'low-power' } } })
    viewer.resolutionScale = Math.min(0.75, 0.75 / (window.devicePixelRatio || 1))
    viewer.targetFrameRate = 20
    const scene = viewer.scene
    const contextLost = (event: Event) => { event.preventDefault(); stop3d('WebGL หยุดทำงาน กลับมาใช้แผนที่ดาวเทียม 2D แล้ว') }
    scene.canvas.addEventListener('webglcontextlost', contextLost)
    removeContextLost = () => scene.canvas.removeEventListener('webglcontextlost', contextLost)
    memoryTimer = setInterval(checkMemory, 1500)
    gisScene = configureGisScene(viewer)
    gisScene.setEnabled(store.gisEffects)
    gisScene.syncSun(store.currentTime, store.daylightPreview)
    scene.screenSpaceCameraController.minimumZoomDistance = 100
    scene.globe.depthTestAgainstTerrain = true
    removeTileProgress = scene.globe.tileLoadProgressEvent.addEventListener((count: number) => {
      terrainTilesPending.value = count
      // Terrain progress must never recreate trails or clamped polylines.
      if (count === 0 && store.showAltitudeLines) for (const state of store.aircraftStates) {
        const f = flights.get(state.aircraft.id)
        if (f && state.sample) updateGround(f, state.sample)
      }
    })
    removePostRender = scene.postRender.addEventListener(() => { if (viewer) cameraHeading.value = Math.round(CMath.toDegrees(viewer.camera.heading)) % 360 })
    removeRenderError = scene.renderError.addEventListener((_scene, renderError) => stop3d(`3D หยุดทำงาน กลับแผนที่ 2D: ${String(renderError)}`))
    inputHandler = new ScreenSpaceEventHandler(scene.canvas)
    inputHandler.setInputAction((click: { position: Cartesian2 }) => { const picked = scene.pick(click.position); if (picked?.id instanceof Entity && picked.id.id.startsWith('aircraft-')) store.selectedAircraftId = picked.id.id.slice('aircraft-'.length) }, ScreenSpaceEventType.LEFT_CLICK)
    rebuild(); ready.value = true
    observer = new ResizeObserver(() => viewer?.resize()); observer.observe(container.value!)
    if (store.showBasemap) void updateBasemap()
    void updateTerrain()
  } catch (e) { stop3d(`เปิด 3D ไม่สำเร็จ กลับแผนที่ 2D: ${e instanceof Error ? e.message : ''}`) }
})
watch(() => store.currentTime, scheduleReplayUpdate)
watch(() => store.daylightPreview, () => gisScene?.syncSun(store.currentTime, store.daylightPreview))
watch(() => store.gisEffects, () => gisScene?.setEnabled(store.gisEffects))
watch(() => store.mission.telemetry, rebuild, { deep: true })
watch(() => store.mission.aircraft, rebuild, { deep: true })
watch(() => [store.showPaths, store.showLabels, store.showAltitudeLines, store.trailSeconds, store.selectedAircraftId], () => { routeEntities.forEach(e => e.show = store.showRecordedRoute && store.showPaths); updatePositions() })
watch(() => store.showGroundGrid, () => { if (store.showGroundGrid && !gridEntities.length) buildGroundGrid(); gridEntities.forEach(e => e.show = store.showGroundGrid); viewer?.scene.requestRender() })
watch(() => store.showRecordedRoute, () => routeEntities.forEach(e => e.show = store.showRecordedRoute && store.showPaths))
watch(() => [store.showBasemap, store.mapStyle], updateBasemap)
watch(() => [store.showTerrain, store.terrainMode], updateTerrain)
watch(() => store.cameraMode, setCamera)
watch(() => store.cameraRevision, setCamera)
onUnmounted(() => { clearInterval(memoryTimer); clearTimeout(replayTimer); removeContextLost?.(); mapRevision++; terrainRevision++; removeImageryError?.(); removeTerrainError?.(); removeTileProgress?.(); restoreBodyScroll(); hudObserver?.disconnect(); window.removeEventListener('keydown', escapeExpanded); observer?.disconnect(); removePostRender?.(); removeRenderError?.(); inputHandler?.destroy(); viewer?.destroy(); viewer = undefined })
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
  <div ref="shell" class="viewer-shell debrief-viewer" :class="{ 'viewer-expanded': expanded }" :style="{ '--scene-header-height': `${headerHeight}px`, '--scene-footer-height': `${footerHeight}px` }" tabindex="0" aria-label="3D debrief viewer. Space plays or pauses; arrow keys seek five seconds." @keydown="keyboard">
    <div ref="container" class="cesium-host"></div>
    <div v-if="error" class="viewer-error" role="alert"><Icon name="AlertTriangle" :size="28"/><strong>3D rendering unavailable</strong><p>{{ error }}</p><span>Telemetry analysis and file imports remain available.</span></div>
    <div v-else-if="!ready" class="viewer-loading"><Icon name="Loader2"/>Initializing debrief scene…</div>
    <template v-if="!error">
      <div ref="overlayHeader" class="debrief-overlay-header">
      <div class="debrief-topline"><div class="debrief-caption"><span class="debrief-live-dot"></span><strong>3D DEBRIEF</strong><span>WGS 84</span></div><span class="map-tag amber">{{ store.mission.simulated ? 'SIMULATED DATA' : 'IMPORTED DATA' }}</span></div>
      <div class="debrief-toolbar" aria-label="Scene display options">
        <button :class="{ active: !store.showBasemap }" :aria-pressed="!store.showBasemap" @click="store.showBasemap = false">Analysis</button>
        <button :class="{ active: store.showBasemap }" :aria-pressed="store.showBasemap" :disabled="mapLoading" @click="store.showBasemap = true">{{ mapLoading ? 'Loading…' : 'Map' }}</button>
        <select v-model="store.mapStyle" class="scene-map-select" aria-label="Map imagery source" @change="store.showBasemap = true"><option value="dark">Dark Canvas</option><option value="satellite">Satellite</option><option value="street">Streets</option><option value="offline">Offline globe</option></select>
        <button :class="{ active: store.showTerrain }" :aria-pressed="store.showTerrain" :disabled="terrainLoading" title="Real elevation terrain. Detail varies by region; requires internet." @click="store.showTerrain = !store.showTerrain">{{ terrainLoading ? 'Terrain…' : '3D Terrain' }}</button>
        <select v-model="store.terrainMode" class="scene-map-select" aria-label="Terrain source" @change="store.showTerrain = true"><option value="regional">Esri Terrain</option><option value="world" :disabled="!worldTerrainConfigured">{{ worldTerrainConfigured ? 'World Terrain' : 'World Terrain · token required' }}</option></select>
        <button :class="{ active: store.gisEffects }" :aria-pressed="store.gisEffects" title="Toggle cinematic grading, subtle bloom and terrain shadows" @click="store.gisEffects = !store.gisEffects">Cinematic</button>
        <button :class="{ active: store.daylightPreview }" :aria-pressed="store.daylightPreview" title="Preview sunlight at 10:00 Thailand time on the recorded date. Telemetry timestamps remain unchanged." @click="store.daylightPreview = !store.daylightPreview">Daylight</button>
        <span class="tool-divider"></span>
        <button title="Toggle metric ground grid" :aria-pressed="store.showGroundGrid" :class="{ active: store.showGroundGrid }" @click="store.showGroundGrid = !store.showGroundGrid"><Icon name="Layers" :size="14"/><span>Grid</span></button>
        <button title="Toggle altitude stalks and projected trails" :aria-pressed="store.showAltitudeLines" :class="{ active: store.showAltitudeLines }" @click="store.showAltitudeLines = !store.showAltitudeLines"><Icon name="MoveUpRight" :size="14"/><span>Altitude</span></button>
        <button title="Show entire recorded route, including samples after the replay cursor" :aria-pressed="store.showRecordedRoute" :class="{ active: store.showRecordedRoute }" @click="store.showRecordedRoute = !store.showRecordedRoute"><Icon name="Activity" :size="14"/><span>Route</span></button>
        <label class="trail-select">TRAIL<select v-model.number="store.trailSeconds" aria-label="Past trail duration"><option v-for="seconds in [30, 60, 120, 300]" :key="seconds" :value="seconds">{{ seconds }}s</option></select></label>
        <button class="expand-scene" :aria-label="expanded ? 'Restore replay panel' : 'Expand replay viewer'" :title="expanded ? 'Restore (Esc)' : 'Expand replay'" @click="expanded = !expanded"><Icon :name="expanded ? 'X' : 'Maximize2'" :size="15"/></button>
      </div>
      </div>
      <div class="debrief-camera-bar" aria-label="Camera shortcuts"><button :class="{ active: store.cameraMode === 'thailand' }" title="Thailand · tilted terrain view" @click="store.cameraMode = 'thailand'">TH</button><button :class="{ active: store.cameraMode === 'overview' }" @click="store.resetCamera()">3D</button><button :class="{ active: store.cameraMode === 'top' }" @click="store.cameraMode = 'top'">TOP</button><button :class="{ active: store.cameraMode === 'side' }" @click="store.cameraMode = 'side'">SIDE</button><button :class="{ active: store.cameraMode === 'free' }" @click="store.cameraMode = 'free'">FREE</button><span></span><button v-for="a in store.mission.aircraft" :key="a.id" :class="{ active: store.cameraMode === a.id }" :style="{ '--track-color': a.color }" :title="`Follow ${a.callsign}`" @click="store.selectedAircraftId = a.id; store.cameraMode = a.id"><i :style="{ background: a.color }"></i>{{ a.id }}</button></div>
      <div class="debrief-compass" title="Camera heading"><div :style="{ transform: `rotate(${-cameraHeading}deg)` }"><span>N</span><Icon name="MoveUpRight" :size="21"/></div><strong>{{ String(cameraHeading).padStart(3, '0') }}°</strong></div>
      <div class="debrief-status-row">
      <div class="debrief-object-list"><button v-for="state in store.aircraftStates" :key="state.aircraft.id" :class="{ selected: store.selectedAircraftId === state.aircraft.id }" :style="{ '--track-color': state.aircraft.color }" @click="store.selectedAircraftId = state.aircraft.id"><i></i><strong>{{ state.aircraft.callsign }}</strong><span>{{ state.sample ? Math.round(state.sample.altitude).toLocaleString() + ' m' : 'NO SAMPLE' }}</span></button></div>
      <div class="debrief-selection" v-if="selectedAircraft"><span :style="{ color: selectedAircraft.color }">{{ selectedAircraft.callsign }}</span><span>{{ selectedState?.sample ? selectedState.sample.interpolated ? 'INTERPOLATED POSITION' : 'RECORDED POSITION' : 'NO POSITION AT THIS TIME' }}</span><span v-if="selectedState?.sample && selectedState.sample.heading === undefined">ATTITUDE NOT RECORDED</span></div>
      </div>
      <div class="debrief-legend"><span v-if="store.showPaths"><i class="trail-key"></i>Past {{ store.trailSeconds }}s</span><span v-if="store.showPaths && store.showRecordedRoute"><i class="route-key"></i>Recorded route · all times</span><span v-if="store.showGroundGrid">Grid {{ gridSpacing / 1000 }} km</span></div>
      <div class="debrief-ground-note" :title="`${mapStatus} | ${terrainStatus}. Aircraft altitude is unchanged; terrain is a visual reference, not verified AGL.`">{{ mapStatus }} · {{ terrainStatus }} · {{ store.daylightPreview ? 'DAYLIGHT PREVIEW' : 'REPLAY SUN' }}<span v-if="terrainActive && terrainTilesPending"> · loading tiles</span></div>
      <div v-if="expanded" ref="transport" class="expanded-transport"><button class="play-button" :disabled="!store.duration" :aria-label="store.playing ? 'Pause replay' : 'Play replay'" @click="togglePlay"><Icon :name="store.playing ? 'Pause' : 'Play'" :size="17"/></button><span class="mono">{{ durationLabel((store.currentTime - store.start) / 1000) }} / {{ durationLabel(store.duration) }}</span><input type="range" aria-label="Expanded replay timeline" :min="store.start" :max="store.end" :value="store.currentTime" :step="100" :disabled="!store.duration" @input="store.seek(Number(($event.target as HTMLInputElement).value))"><label>Speed<select v-model.number="store.speed" aria-label="Expanded playback speed"><option v-for="speed in [0.5, 1, 2, 4]" :key="speed" :value="speed">{{ speed }}×</option></select></label><span class="mono">{{ new Date(store.currentTime).toISOString().slice(11, 19) }} UTC</span></div>
    </template>
    <button v-if="error && expanded" class="error-close button" @click="expanded = false">Restore panel</button>
  </div>
  </Teleport>
</template>
