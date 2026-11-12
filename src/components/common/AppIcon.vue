<script setup lang="ts">
import { Activity, Plane, ShieldCheck, Upload, Download, Play, Pause, RotateCcw, Settings2, ChevronDown, Check, AlertTriangle, X, Crosshair, Layers, Maximize2, Search, FileText, Clock3, Radio, MoveUpRight, CircleHelp, Loader2, Eye, FolderOpen, Database, ArrowRight, SlidersHorizontal } from 'lucide-vue-next'
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })
const icons: Record<string, unknown> = { Activity, Plane, ShieldCheck, Upload, Download, Play, Pause, RotateCcw, Settings2, ChevronDown, Check, AlertTriangle, X, Crosshair, Layers, Maximize2, Search, FileText, Clock3, Radio, MoveUpRight, CircleHelp, Loader2, Eye, FolderOpen, Database, ArrowRight, SlidersHorizontal }
</script>
<template><component :is="icons[name] || Activity" :size="size" :stroke-width="1.65" aria-hidden="true" /></template>
