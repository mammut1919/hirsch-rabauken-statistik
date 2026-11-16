<template>
  <div class="view-heading">
    <div>
      <p class="eyebrow">PROJEKTINFORMATIONEN</p>
      <h2>Über diese Anwendung</h2>
    </div>
  </div>

  <div class="about-content">
    <section class="about-panel" aria-labelledby="project-heading">
      <h3 id="project-heading">Projekt</h3>
      <dl class="project-details">
        <div>
          <dt>Name</dt>
          <dd>Hirsch-Rabauken-Statistik</dd>
        </div>
        <div>
          <dt>Entwicklung und Pflege</dt>
          <dd>Marco Deffert</dd>
        </div>
        <div>
          <dt>Mannschaft</dt>
          <dd>Hirsch-Rabauken</dd>
        </div>
      </dl>
      <p>Ein privates, nicht kommerzielles Projekt ohne Werbung und ohne Einnahmen.</p>
    </section>

    <section class="about-panel" aria-labelledby="data-heading">
      <h3 id="data-heading">Datenherkunft</h3>
      <p>
        Die zugrunde liegenden Spielpläne, Ergebnisse und Mannschaftsdaten sind im 3K-Darts-Portal
        frei und öffentlich einsehbar.
      </p>
      <p>
        Die Spieler- und Doppelstatistiken werden von dieser Anwendung anhand der verfügbaren
        Spieldaten selbst berechnet.
      </p>
      <p>
        Diese Anwendung ist ein unabhängiges Projekt und steht in keiner offiziellen Verbindung
        zu 3K-Darts.
      </p>
    </section>

    <section class="about-panel" aria-labelledby="team-heading">
      <h3 id="team-heading">Mannschaft</h3>
      <a
        href="https://portal.3k-darts.com/frontend/events/9/event/40293/participants/682469"
        target="_blank"
        rel="noopener noreferrer"
      >
        Hirsch-Rabauken bei 3K Darts
        <i class="pi pi-external-link" aria-hidden="true" />
      </a>
    </section>
  </div>
</template>

<style scoped>
.about-content {
  display: grid;
  gap: 16px;
  max-width: 820px;
}

.about-panel {
  padding: 22px;
  border: 1px solid #273640;
  border-radius: 14px;
  background: #0e161f;
}

.about-panel h3 {
  margin: 0 0 14px;
  color: #eaf1f5;
  font-size: 16px;
  font-weight: 600;
}

.about-panel p,
.project-details {
  margin: 0;
  color: #95a3af;
  font-size: 13px;
  line-height: 1.7;
}

.about-panel p + p {
  margin-top: 9px;
}

.project-details {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.project-details div {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) 1fr;
  gap: 12px;
}

.project-details dt {
  color: #82919e;
}

.project-details dd {
  margin: 0;
  color: #c8d5dc;
}

.about-panel a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #54e0d2;
  font-size: 13px;
  text-decoration: none;
}

.about-panel a:hover,
.about-panel a:focus-visible {
  color: #8df0e6;
  text-decoration: underline;
}

.about-panel a .pi {
  font-size: 11px;
}

@media (max-width: 430px) {
  .about-panel {
    padding: 16px;
  }

  .project-details div {
    grid-template-columns: 1fr;
    gap: 1px;
  }
}
</style>
