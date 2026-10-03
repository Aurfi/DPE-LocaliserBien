<template>
  <nav aria-label="Type de recherche" class="search-navigation">
    <button v-for="tab in tabs" :key="tab.id" type="button" @click="$emit('tab-change', tab.id)"
      :aria-pressed="activeTab === tab.id" :class="['search-navigation-item', { 'is-active': activeTab === tab.id }]">
      {{ tab.label }}
    </button>
  </nav>
</template>
<script>
export default {
  name: 'TabNavigation',
  props: { activeTab: { type: String, required: true } },
  emits: ['tab-change'],
  data() {
    return {
      tabs: [
        { id: 'locate', label: 'Trouver un bien' },
        { id: 'recent', label: 'Biens à proximité' }
      ]
    }
  }
}
</script>
