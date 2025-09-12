<template>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 my-4">
    <div class="flex items-start space-x-2">
      <Shield class="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        <h3 class="font-semibold mb-1">Données publiques DVF & DPE</h3>
        <p class="text-xs leading-relaxed">
          Conformément à l'article R*. 112 A-3 du LPF, les données DVF (Demandes de Valeurs Foncières) et DPE 
          (Diagnostics de Performance Énergétique) ne font pas l'objet d'une indexation par les moteurs de recherche. 
          L'accès résulte de votre démarche volontaire. Les données sont issues des bases publiques 
          DVF+ (Cerema/DGFiP) et ADEME (DPE) et restent la propriété de leurs émetteurs respectifs.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { Shield } from 'lucide-vue-next'

export default {
  name: 'LegalCompliance',
  components: {
    Shield
  }
}
</script>