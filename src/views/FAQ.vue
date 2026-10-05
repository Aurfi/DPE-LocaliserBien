<template>
  <article class="information-page">
    <router-link to="/" class="information-back quiet-link">Revenir à la recherche</router-link>

    <header class="information-header">
      <h1 class="search-heading">Guide et informations</h1>
      <p>Deux façons de rechercher un bien dans les données DPE. Gratuit, sans compte.</p>
    </header>

    <section class="information-guide" aria-labelledby="guide-annonce">
      <h2 id="guide-annonce">Retrouver un bien à partir d’une annonce</h2>
      <p>Dans l’onglet <strong>Trouver un bien</strong>, recopiez les informations de l’annonce.</p>
      <dl class="information-criteria">
        <div>
          <dt>Commune et surface</dt>
          <dd>La ville ou le code postal, puis la surface en m².</dd>
        </div>
        <div>
          <dt>Consommation</dt>
          <dd>La valeur en kWh/m²/an, près de l’étiquette DPE. Si seule une lettre est indiquée, choisissez sa classe de A à G.</dd>
        </div>
        <div>
          <dt>Pour affiner</dt>
          <dd>Ajoutez le type de bien et, si vous les connaissez, les GES en kgCO₂/m²/an ou la classe climat. Ces critères sont facultatifs.</dd>
        </div>
      </dl>
      <p>Cliquez sur <strong>Localiser</strong>, puis comparez les résultats avec l’annonce.</p>
      <p><a href="/guides/retrouver-adresse-annonce/">Voir la méthode avec un exemple d’annonce</a>.</p>
      <p class="information-example">Exemple : Marseille 13008 · 65 m² · 173 kWh/m²/an.</p>
    </section>

    <section class="information-section" aria-labelledby="guide-proximite">
      <h2 id="guide-proximite">Explorer les biens à proximité</h2>
      <p>Dans <strong>Biens à proximité</strong>, saisissez une adresse, choisissez un rayon et une période. Vous pouvez affiner par surface, type de bien, consommation ou GES.</p>
      <p>Vérifiez l’adresse retenue en tête des résultats. Un DPE récent ne signifie pas que le logement est en vente ou en location.</p>
    </section>

    <section id="resultats" class="information-section" aria-labelledby="guide-resultats">
      <h2 id="guide-resultats">Lire les résultats</h2>
      <p>Plusieurs biens peuvent correspondre. Comparez la surface, les valeurs DPE, le type de bien et la date du diagnostic avec l’annonce.</p>
      <p>Le score mesure la proximité des critères, pas une probabilité d’identification. La carte aide à situer un résultat, sans confirmer qu’il s’agit du bien recherché.</p>
    </section>

    <section class="information-section" aria-labelledby="guide-lectures">
      <h2 id="guide-lectures">Pour aller plus loin</h2>
      <p><a href="/guides/rechercher-avec-dpe/">Quelles valeurs du DPE saisir ?</a> · <a href="/guides/dpe-recent-vente/">Que signifie un DPE récent ?</a></p>
      <p><a href="/documentation/agents/">Documentation pour les assistants et agents</a></p>
    </section>

    <section class="information-section" aria-labelledby="guide-questions">
      <h2 id="guide-questions">Questions utiles</h2>
      <div class="information-questions">
        <details>
          <summary>Pourquoi n’ai-je aucun résultat ?</summary>
          <div class="information-answer">
            <p>Vérifiez la commune, la surface et les unités : la consommation est en kWh/m²/an, les GES en kgCO₂/m²/an. Une annonce peut arrondir les valeurs ou afficher une étiquette actualisée.</p>
            <p>Un diagnostic très récent peut aussi ne pas être encore disponible. Demandez le DPE complet à l’annonceur pour comparer les valeurs.</p>
          </div>
        </details>
        <details>
          <summary>Quelle valeur ou classe DPE faut-il saisir ?</summary>
          <div class="information-answer">
            <p>Recopiez celle de l’annonce ou du diagnostic. Depuis juillet 2021, la classe DPE tient compte de la consommation et des émissions de gaz à effet de serre. La consommation seule ne suffit donc pas à retrouver la classe officielle.</p>
            <p>En 2026, le coefficient de conversion de l’électricité est passé de 2,3 à 1,9. Ne convertissez pas vous-même la consommation totale : un logement peut utiliser plusieurs énergies. Une attestation officielle peut actualiser son étiquette.</p>
            <p><a href="https://www.ecologie.gouv.fr/actualites/evolutions-du-calcul-du-dpe-reponses-vos-questions" target="_blank" rel="noopener noreferrer">Comprendre l’évolution du DPE en 2026</a>.</p>
          </div>
        </details>
        <details>
          <summary>D’où viennent les diagnostics ?</summary>
          <div class="information-answer">
            <p>Ils proviennent des <a href="https://data.ademe.fr/" target="_blank" rel="noopener noreferrer">données publiques de l’ADEME</a>. Certaines adresses ou caractéristiques peuvent être manquantes ou erronées, notamment dans les anciens diagnostics.</p>
            <p>Avec son numéro, vous pouvez <a href="https://observatoire-dpe-audit.ademe.fr/" target="_blank" rel="noopener noreferrer">vérifier un DPE et retrouver son attestation sur l’Observatoire de l’ADEME</a>.</p>
          </div>
        </details>
        <details>
          <summary>Mes recherches sont-elles enregistrées ?</summary>
          <div class="information-answer">
            <p>L’historique est désactivé par défaut. Vous pouvez l’activer ou l’effacer en bas de page ; il reste enregistré dans votre navigateur.</p>
            <p>Les recherches interrogent l’ADEME et, selon le mode, l’IGN. Ouvrir la fiche d’un résultat charge une carte Google Maps : Google reçoit la localisation du bien et des informations techniques de connexion.</p>
            <p><router-link to="/mentions-legales#vie-privee">Consulter les informations sur la vie privée</router-link>.</p>
          </div>
        </details>
      </div>
    </section>
  </article>
</template>

<script>
export default {
  name: 'Informations'
}
</script>

<style scoped>
.information-page {
  width: min(100% - 2rem, 896px);
  margin: 0 auto;
  padding-block: 1.25rem 0;
  color: #4b5563;
  font-size: 0.9375rem;
  line-height: 1.6;
}

.information-back {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  text-decoration: underline;
}

.information-header {
  margin-block: 0.75rem 1.5rem;
}

.information-header p {
  margin-top: 0.5rem;
}

.information-page h2 {
  color: #111827;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 0.75rem;
}

.information-page strong,
.information-criteria dt {
  color: #374151;
  font-weight: 600;
}

.information-guide {
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.information-criteria {
  margin-block: 1.125rem;
}

.information-criteria > div + div {
  margin-top: 0.875rem;
}

.information-criteria dt {
  margin-bottom: 0.125rem;
}

.information-example {
  margin-top: 0.75rem;
  font-size: 0.875rem;
}

.information-section {
  margin-top: 1.75rem;
  scroll-margin-top: 1.5rem;
}

.information-section p + p {
  margin-top: 0.625rem;
}

.information-questions {
  border-top: 1px solid #d1d5db;
}

.information-questions details {
  border-bottom: 1px solid #d1d5db;
}

.information-questions summary {
  min-height: 48px;
  padding-block: 0.875rem;
  color: #374151;
  cursor: pointer;
  font-weight: 500;
}

.information-questions summary::marker {
  color: #6b7280;
  font-size: 0.75rem;
}

.information-answer {
  padding: 0 0 1rem 1.125rem;
}

.information-answer a {
  color: #244a68;
  text-decoration: underline;
  text-underline-offset: 3px;
}

:global(.dark .information-page) {
  color: #cbd5e1;
}

:global(.dark .information-page h2),
:global(.dark .information-page strong),
:global(.dark .information-criteria dt),
:global(.dark .information-questions summary) {
  color: #f3f4f6;
}

:global(.dark .information-guide) {
  border-color: #374151;
  background: #1f2937;
}

:global(.dark .information-questions),
:global(.dark .information-questions details) {
  border-color: #4b5563;
}

:global(.dark .information-questions summary::marker) {
  color: #9ca3af;
}

:global(.dark .information-answer a) {
  color: #9bc0de;
}

@media (min-width: 640px) {
  .information-page {
    padding-top: 1.75rem;
  }

  .information-guide {
    padding: 1.5rem;
  }

  .information-criteria > div {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 1rem;
  }
}
</style>
