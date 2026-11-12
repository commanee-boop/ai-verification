<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useMissionStore } from '../../stores/mission'
import { previewFile } from '../../services/importService'
import type { ImportKind, ImportPreview } from '../../types'
import Icon from '../common/AppIcon.vue'
const props = defineProps<{ aircraftId: string; kind: ImportKind; initialFile?: File }>(), emit = defineEmits<{ close: [] }>()
const targetAircraft = ref(props.aircraftId), targetKind = ref(props.kind)
const store = useMissionStore(), preview = ref<ImportPreview>(), busy = ref(false), error = ref(''), dragging = ref(false), input = ref<HTMLInputElement>()
async function read(file?: File) { if (!file) return; busy.value = true; preview.value = undefined; error.value = ''; try { preview.value = await previewFile(file, targetAircraft.value, targetKind.value, store.mission.id) } catch (e) { error.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false } }
watch([targetAircraft, targetKind], () => { preview.value = undefined; error.value = '' })
onMounted(() => { if (props.initialFile) void read(props.initialFile) })
function dropped(e: DragEvent) { dragging.value = false; void read(e.dataTransfer?.files[0]) }
function commit() { try { if (preview.value) store.applyImport(preview.value); emit('close') } catch (e) { error.value = String(e) } }
</script>
<template>
  <div class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <section role="dialog" aria-modal="true" aria-labelledby="import-title" class="modal">
      <div class="section-heading"><div><span class="eyebrow">DATA INGESTION</span><h2 id="import-title">Import {{ targetKind }} · Aircraft {{ targetAircraft }}</h2></div><button class="icon-button" aria-label="Close import" @click="emit('close')"><Icon name="X" /></button></div>
      <p class="muted">Preview and validate before replacing this aircraft’s records. Existing timestamps are preserved.</p>
      <div class="button-row mb-4"><label class="flex-1">Target aircraft<select v-model="targetAircraft" :disabled="busy"><option v-for="a in store.mission.aircraft" :key="a.id" :value="a.id">{{ a.id }} · {{ a.callsign }}</option></select></label><label class="flex-1">Record type<select v-model="targetKind" :disabled="busy"><option value="telemetry">Telemetry</option><option value="gps">GPS positions</option><option value="events">Shot events</option></select></label></div>
      <input ref="input" class="sr-only" type="file" accept=".csv,.json,.gpx" @change="read(($event.target as HTMLInputElement).files?.[0])">
      <button class="drop-zone" :class="{ dragging }" @click="input?.click()" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="dropped"><Icon :name="busy ? 'Loader2' : 'Upload'" :size="30"/><strong>{{ busy ? 'Validating file…' : 'Drop a file here, or browse' }}</strong><span>CSV, JSON, GPX · Up to 10 MB / 50,000 records</span></button>
      <div class="schema-hint"><strong>Required fields</strong><code>{{ targetKind === 'events' ? 'id, timestamp, weaponProfile (optional)' : 'timestamp, latitude, longitude, altitude' }}</code><span>ISO 8601 with timezone · altitude in meters · aircraftId / flightId optional (must match if present)</span></div>
      <p v-if="error" class="error-box" role="alert">{{ error }}</p>
      <div v-if="preview" class="preview-box"><strong>{{ preview.filename }}</strong><p>{{ preview.telemetry.length + preview.events.length }} accepted rows · {{ preview.errors.length }} errors</p><div class="preview-scroll"><p v-for="e in preview.errors.slice(0, 30)" :key="e" class="danger">{{ e }}</p><pre>{{ JSON.stringify((targetKind === 'events' ? preview.events : preview.telemetry).slice(0, 3), null, 2) }}</pre></div></div>
      <div class="modal-actions"><button class="button" @click="emit('close')">Cancel</button><button class="button primary" :disabled="busy || !preview || !!preview.errors.length" @click="commit"><Icon name="Check" /> Confirm import</button></div>
    </section>
  </div>
</template>
