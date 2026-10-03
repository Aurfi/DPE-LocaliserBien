<template>
  <section class="search-loading" role="status" aria-live="polite" aria-atomic="true" :aria-busy="!isDataReady">
    <svg class="location-sketch" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <path class="map-street" d="M8 35H65L95 10M28 110V68L8 48M152 86H100L65 35M65 35V120M112 0V55L152 86M100 86L88 120M0 86H65" />
      <path class="map-block" d="M37 12H52V25H37zM80 52H99V69H80zM120 101H141V112H120zM14 94H25V111H14zM123 19H148V49H123z" />
      <circle class="location-ring" cx="65" cy="35" r="14" />
      <circle class="location-point" cx="65" cy="35" r="5" />
    </svg>
    <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Recherche en cours</h1>
    <p v-if="commune" class="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300 break-words">{{ commune }}</p>
    <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">Consultation des données publiques DPE.</p>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Les résultats s’affichent dès qu’ils sont disponibles.</p>
    <button type="button" class="btn-secondary mt-6 text-sm" @click="$emit('cancel')">Revenir aux critères</button>
  </section>
</template>

<script>
export default {
  name: 'TriangulationAnimation',
  emits: ['cancel'],
  props: {
    commune: { type: String, required: true },
    coordinates: { type: Object, default: null },
    onComplete: { type: Function, required: true },
    isDataReady: { type: Boolean, default: false },
    waitingForResults: { type: Boolean, default: false },
    resultsCount: { type: Number, default: null }
  },
  data() {
    return { completed: false }
  },
  mounted() {
    this.completeWhenReady()
  },
  watch: {
    isDataReady() {
      this.completeWhenReady()
    }
  },
  methods: {
    completeWhenReady() {
      if (!this.isDataReady || this.completed) return
      this.completed = true
      this.onComplete()
    }
  }
}
</script>

<style scoped>
.search-loading { max-width: 40rem; min-height: 55vh; margin: 0 auto; padding: 3rem 1.25rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.location-sketch { width: 160px; height: 120px; margin-bottom: 1.75rem; }
.map-street { stroke: #d6dde3; stroke-width: 2; }
.map-block { fill: #e9edf0; }
.location-ring { stroke: #456b88; stroke-width: 1.5; transform-origin: 65px 35px; animation: locate 2.4s ease-in-out infinite; }
.location-point { fill: #244a68; }
:global(.dark) .map-street { stroke: #3b4655; }
:global(.dark) .map-block { fill: #253244; }
:global(.dark) .location-ring { stroke: #9bc0de; }
:global(.dark) .location-point { fill: #9bc0de; }
@keyframes locate { 0%, 100% { opacity: .5; transform: scale(.85); } 50% { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .location-ring { animation: none; } }
</style>
