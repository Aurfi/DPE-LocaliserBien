<template>
  <section aria-label="Historique local" class="mt-6 text-sm text-gray-600 dark:text-gray-400">
    <label class="inline-flex items-start gap-2 text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        :checked="historyEnabled"
        aria-describedby="history-explanation"
        class="mt-1"
        @change="changePreference"
      />
      Conserver mes recherches sur cet appareil
    </label>
    <p id="history-explanation" class="mt-1 max-w-2xl">
      Option désactivée par défaut. L'historique est enregistré uniquement dans ce navigateur.
    </p>
    <div v-if="confirmClear" class="mt-2">
      <p>Effacer définitivement les recherches enregistrées dans les deux modes ?</p>
      <div class="mt-1 flex flex-wrap gap-4">
        <button type="button" class="quiet-link" @click="clearHistory">Tout effacer</button>
        <button type="button" class="quiet-link" @click="confirmClear = false">Annuler</button>
      </div>
    </div>
    <button v-else type="button" class="quiet-link mt-2" @click="confirmClear = true; status = ''">
      Effacer les recherches enregistrées
    </button>
    <p v-if="status" role="status" class="mt-1">{{ status }}</p>
  </section>
</template>

<script>
import { ref } from 'vue'
import { useRecherches } from '../../stores/useRecherches.js'

export default {
  name: 'PreferenceHistorique',
  setup() {
    const store = useRecherches()
    const confirmClear = ref(false)
    const status = ref('')
    const changePreference = event => {
      const enabled = event.target.checked
      const saved = store.setHistoryEnabled(enabled)
      event.target.checked = store.historyEnabled.value
      status.value = saved
        ? ''
        : enabled
          ? "L'historique n'a pas pu être activé. La recherche reste disponible."
          : "L'historique est désactivé pour cette page, mais ce choix n'a pas pu être mémorisé."
    }
    const clearHistory = () => {
      const cleared = store.clearSearchHistory('all')
      confirmClear.value = false
      status.value = cleared
        ? 'Les recherches enregistrées ont été effacées.'
        : "L'effacement a échoué. Vérifiez les autorisations de stockage de votre navigateur."
    }
    return { historyEnabled: store.historyEnabled, confirmClear, status, changePreference, clearHistory }
  }
}
</script>
