<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useMissionStore } from '../../stores/mission'
import { sortedTrack } from '../../utils/replay'
import { interval } from '../../utils/quality'
echarts.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])
const store = useMissionStore(), host = ref<HTMLElement>(); let chart: echarts.ECharts | undefined, observer: ResizeObserver
function draw() {
  chart?.setOption({ animation: false, grid: { left: 48, right: 18, top: 15, bottom: 22 }, tooltip: { trigger: 'axis', backgroundColor: '#14263c', borderColor: '#2b4058', textStyle: { color: '#e2e8f0' } }, xAxis: { type: 'time', min: store.start, max: store.end, axisLabel: { color: '#748ba4', fontSize: 10, formatter: (v: number) => new Date(v).toISOString().slice(11, 16) }, axisLine: { lineStyle: { color: '#25374b' } }, splitLine: { show: false } }, yAxis: { type: 'value', axisLabel: { color: '#748ba4', fontSize: 10 }, splitLine: { lineStyle: { color: '#1d3045', type: 'dashed' } } }, series: store.mission.aircraft.map(a => { const rows = sortedTrack(store.mission.telemetry, a.id), step = interval(rows); const data: (number | null)[][] = []; rows.forEach((t, i) => { if (i && Date.parse(t.timestamp) - Date.parse(rows[i - 1].timestamp) > step * 1500) data.push([Date.parse(rows[i - 1].timestamp) + 1, null]); data.push([Date.parse(t.timestamp), t.altitude]) }); return { name: a.callsign + ' · altitude (m)', type: 'line', showSymbol: false, connectNulls: false, lineStyle: { width: 1.8 }, itemStyle: { color: a.color }, data } }) }, true)
}
onMounted(() => { chart = echarts.init(host.value!); draw(); observer = new ResizeObserver(() => chart?.resize()); observer.observe(host.value!) }); watch(() => store.mission.telemetry, draw, { deep: true }); onUnmounted(() => { observer?.disconnect(); chart?.dispose() })
</script>
<template><div ref="host" class="altitude-chart" role="img" aria-label="Altitude over mission time in meters for both aircraft; missing samples create gaps"></div></template>
