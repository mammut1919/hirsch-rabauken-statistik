
# Projektregeln – Hirsch-Rabauken Statistik

## Projektziel
Browserbasierte Statistik-Anwendung für das Dart-Team
Hirsch-Rabauken auf Basis der 3K-Darts-API.

Die Anwendung soll später über GitHub Pages bereitgestellt werden.

## Technologien
- Vue 3
- TypeScript
- Vite
- Vue Router
- Pinia
- PrimeVue 4 (MIT)
- PrimeUIX Themes 2.x: Aura-Preset (`@primeuix/themes`), Dark Mode über `.app-dark`
- PrimeIcons
- Vitest
- ESLint und Prettier

## Entwicklungsregeln
- Vue Composition API mit `<script setup lang="ts">` verwenden.
- TypeScript konsequent nutzen.
- Komponenten übersichtlich und wiederverwendbar gestalten.
- Geschäftslogik von der Darstellung trennen.
- Bestehende Projektstruktur und Konfiguration beachten.
- Keine zusätzlichen Bibliotheken ohne Begründung installieren.
- Keine unnötigen Änderungen an bestehenden Dateien vornehmen.
- Vorhandene Funktionen nicht ohne Rücksprache entfernen.

## Fachliche Regeln
- Datenquelle ist die 3K-Darts-API.
- Zunächst ausschließlich Hirsch-Rabauken auswerten.
- Datenstrukturen für spätere Erweiterungen offen halten.
- Spieler anhand stabiler Spieler-IDs identifizieren.
- Doppel unabhängig von der Reihenfolge der Spieler zusammenfassen.
- Offene Spiele zählen weder als Sieg noch als Niederlage.
- Mannschaftsergebnisse stammen aus den Spielplänen.
- Einzel- und Doppelergebnisse stammen aus den Spielberichten.

## Saisonauswahl
- Standardmäßig beim vollständigen Anwendungsstart die aktuelle Saison auswählen.
- Keine dauerhafte Speicherung der Auswahl.
- Früheste Saison: 2026, 1. Halbjahr.
- Auswahl "Gesamt" summiert alle verfügbaren Saisons.
- Saisonfilter gelten einheitlich für alle Statistikbereiche.
- Neue Saisons sollen automatisch berücksichtigt werden.

## Design
- Desktop-first, responsive Browser-Anwendung.
- Dunkles Erscheinungsbild.
- PrimeVue 4 mit dem Aura-Preset aus `@primeuix/themes`; Dark Mode über `.app-dark`.
- Türkis als Akzentfarbe.
- Grün für Siege, Rot für Niederlagen.
- Einheitliche Navigation und Gestaltung.

## Qualitätssicherung
- Vitest für automatisierte Tests verwenden.
- Statistikberechnungen mit Referenzdaten vergleichen.
- Änderungen an Statistikregeln immer durch Tests absichern.
- Keine erfundenen oder fest codierten Statistikwerte.
- Bestehende Tests müssen weiterhin funktionieren.

## Zusammenarbeit mit Codex
- Aufgaben möglichst klein und klar abgrenzen.
- Vor Änderungen kurz den geplanten Umfang nennen.
- Keine unnötigen Installationen oder Refactorings.
- Keine Architekturentscheidungen eigenmächtig treffen.
- Bei unklaren Anforderungen zuerst nachfragen.
- Änderungen und Testergebnisse verständlich zusammenfassen.
