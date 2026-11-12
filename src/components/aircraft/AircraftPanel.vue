<script setup lang="ts">
import { ref } from 'vue'
import { useMissionStore } from '../../stores/mission'
import Icon from '../common/AppIcon.vue'
import ImportDialog from './ImportDialog.vue'
import type { ImportKind } from '../../types'
const store = useMissionStore(), dialog = ref<{ aircraftId: string; kind: ImportKind; initialFile?: File }>()
function open(id = store.mission.aircraft[0]?.id, kind: ImportKind = 'telemetry') { if (id) dialog.value = { aircraftId: id, kind } }
function dropped(e: DragEvent) { const file = e.dataTransfer?.files[0], aircraftId = store.mission.aircraft[0]?.id; if (file && aircraftId) dialog.value = { aircraftId, kind: 'telemetry', initialFile: file } }
defineExpose({ open })
</script>
<template>
  <aside class="panel aircraft-panel">
    <div class="panel-heading"><div class="heading-icon"><Icon name="Plane" /></div><div><h2>Aircraft configuration</h2><span class="muted small">Sources & flight parameters</span></div><span class="count-chip">{{ store.mission.aircraft.length }}</span></div>
    <div class="panel-scroll aircraft-scroll">
      <div class="section-label">MISSION AIRCRAFT <span>01 — {{ String(store.mission.aircraft.length).padStart(2, '0') }}</span></div>
      <section v-for="a in store.mission.aircraft" :key="a.id" class="aircraft-card" :style="{ '--aircraft-color': a.color }">
        <div class="aircraft-title"><span class="aircraft-letter">{{ a.id }}</span><div><strong>Aircraft {{ a.id }}</strong><span class="small muted">{{ a.telemetryMode }}</span></div><span class="tiny-status"><i></i>CONFIGURED</span></div>
        <label>Aircraft model<input v-model="a.model" aria-label="Aircraft model"></label>
        <label>Aircraft ID / Callsign<input v-model="a.callsign" aria-label="Aircraft callsign"></label>
        <div class="field-row"><label>ACMI pod installed<select v-model="a.podInstalled"><option :value="true">Yes · Installed</option><option :value="false">No · GPS only</option></select></label></div>
        <label>Data source<select v-model="a.dataSource"><option>DCS World</option><option>GPS + Shot Event</option><option>CSV / JSON</option><option>GPX recorder</option><option>Cubic ICADS (future adapter)</option></select></label>
        <button v-if="a.id === 'A'" class="upload-button" @click="open(a.id, 'telemetry')"><Icon name="Upload" :size="15" />Import telemetry file<span>CSV / JSON / GPX</span></button>
        <template v-else><button class="upload-button" @click="open(a.id, 'gps')"><Icon name="Upload" :size="15"/>Import GPS file<span>CSV / GPX</span></button><button class="upload-button" @click="open(a.id, 'events')"><Icon name="Upload" :size="15"/>Import shot events<span>CSV / JSON</span></button></template>
        <button v-if="a.id === 'A'" class="text-button small" @click="open(a.id, 'events')">+ Import shot event log</button>
      </section>
      <div class="proxy-notice"><Icon name="AlertTriangle" :size="17"/><div><strong>Simulator model difference</strong><p>DCS F-16C is a data proxy for the configured F-16A/B. It does not validate either aircraft model.</p></div></div>
      <div class="profile-row"><span class="muted">Training profile</span><strong>AIM-120 AMRAAM</strong><span class="small muted">Event metadata only · no weapon simulation</span></div>
      <button class="drop-zone compact" @click="open()" @dragover.prevent @drop.prevent="dropped"><Icon name="FolderOpen" :size="23"/><strong>Import mission data</strong><span>Select an aircraft, preview & validate</span></button>
    </div>
    <div class="panel-footer"><button class="button primary full" :disabled="store.loading" @click="store.loadDemo()"><Icon :name="store.loading ? 'Loader2' : 'Database'" :size="16"/>Load demo data</button><div class="button-row"><button class="button" @click="store.validate()"><Icon name="ShieldCheck" :size="15"/>Validate</button><button class="button" @click="store.reset()"><Icon name="RotateCcw" :size="15"/>Reset</button></div></div>
    <ImportDialog v-if="dialog" v-bind="dialog" @close="dialog = undefined" />
  </aside>
</template>
