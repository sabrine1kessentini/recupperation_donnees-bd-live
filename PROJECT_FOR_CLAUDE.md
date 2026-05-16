# Projet - Résumé pour Claude (démarrage IA)

But: fournir à Claude un panorama complet du projet pour démarrer la partie IA (analyse des données, modèles, intégration).

---

## Contexte général
Ce dépôt contient une application Smart Building (front-end TypeScript/React + divers services Java/Node) et des composants de collecte/traitement de données. L'objectif est d'ajouter des fonctionnalités IA (analyse, détection d'alertes, prédiction, enrichissement des données temps réel).

## Arborescence principale (racine)
- `alert-service/` : service Java (Spring Boot ?) lié aux alertes. Contient `pom.xml`, code Java sous `src/main/java`, et `resources/application.properties`.
- `auth-service/` : service d'authentification Java, avec `pom.xml`, jar de build dans `target/`.
- `back/` : service Node.js (backend léger). Contient `index.js`, `package.json`, Dockerfile.
- `recupp_donnees/` : composants et scripts pour la récupération et le traitement de données (moteur Java/Maven, données `data/` : `mapping_final.json`, fichiers IFC `otc.ifc`, `otc.enriched.ifc`).
- `Smart Building Management App (1)/` : application front-end (Vite + React + TypeScript). Principal code dans `src/`.
- Fichiers utilitaires à la racine : `docker-compose.yml`, `tsconfig.json`, `DATA_FLOW.md`, etc.

## Points importants à connaître (fichiers clés)
- Frontend (UI) :
  - `Smart Building Management App (1)/src/main.tsx` — point d'entrée.
  - `Smart Building Management App (1)/src/app/App.tsx` — structure de l'app.
  - `Smart Building Management App (1)/src/app/components/` — composants UI (ex : `DashboardViewOccupant.tsx`).
  - `Smart Building Management App (1)/src/services/api.ts` — wrapper pour appels API.
  - `Smart Building Management App (1)/src/services/websocket.ts` — client WebSocket temps réel.
  - `Smart Building Management App (1)/src/hooks/useRealtimeData.ts` — hook custom pour données temps réel.

- Backend Node.js :
  - `back/index.js` — serveur Express (ou similaire) qui expose des routes API.
  - `back/package.json` — dépendances et scripts de démarrage.

- Services Java :
  - `alert-service/` et `auth-service/` — services Spring Boot (ou équivalent). Points d'intérêt : endpoints REST exposés, configuration `application.properties`, intégration possible à une base de données.

- Récupération données :
  - `recupp_donnees/data/mapping_final.json` — mapping utile pour transformation des données.
  - Fichiers `*.ifc` (format IFC pour maquettes BTP) — potentielle source pour features (extraction d'entités spatiales, surfaces, volumes).

- Configuration & build :
  - `docker-compose.yml` — configuration multi-conteneurs possible.
  - `tsconfig.json`, `Smart Building Management App (1)/package.json` (ou `pnpm-workspace.yaml`) — scripts de dev/build frontend.

## Données disponibles et formats
- JSON: `mapping_final.json` et autres fichiers de configuration.
- IFC: maquettes bâtiment (`*.ifc`) — format riche pour extraction géométrique/hiérarchique.
- Endpoints REST / WebSocket: flux temps réel via `websocket.ts` et `useRealtimeData`.
- Bases / persistence: vérifier `application.properties` dans les services Java pour config DB (Postgres, MySQL, etc.).

## Où intégrer l'IA (suggestions d'emplacements d'intégration)
- Prétraitement / ETL (dans `recupp_donnees/`): ingestion, nettoyage, enrichissement, génération de jeux d'entraînement.
- Service de scoring / inference: créer un microservice (Python/Flask/FastAPI) ou endpoint Node qui reçoit features et renvoie prédictions.
- En temps réel: intégrer modèle d'inférence dans le pipeline WebSocket/backend pour scoring instantané (fichier d'intérêt: `Smart Building Management App (1)/src/services/websocket.ts`).
- Frontend: afficher prédictions, explications (SHAP, scores), et alertes dans `DashboardViewOccupant.tsx`.

## Points techniques à vérifier pour Claude
- Quels endpoints REST existent déjà dans `back/`, `alert-service/`, `auth-service/` ? Lister routes via `back/index.js` et controllers Java.
- Où sont stockées les données historiques (BD) ? Vérifier `application.properties` dans `alert-service` et `auth-service`.
- Format des messages WebSocket (payloads) : inspecter `websocket.ts` et `useRealtimeData.ts`.
- Volume et cadence des données temps réel (sensible pour choisir modèle et infra).
- Disponibilité d'un GPU ou contraintes d'hébergement (Docker / Cloud) pour l'inférence.

## Tâches initiales proposées pour Claude (prioritaires)
1. Explorer les endpoints backend et décrire les API utilisables pour ingestion et scoring.
2. Lister toutes les sources de données (IFC, JSON, DB, WebSocket) et proposer un schéma de features initial.
3. Proposer une pipeline ETL minimale (scripts, formats, fréquence) pour produire datasets d'entraînement.
4. Choisir 2-3 modèles candidats pour tâches probables (ex : classification d'alerte, détection d'anomalie, prévision de consommation) avec justification.
5. Fournir exemples de payloads d'entrée/sortie pour l'inférence en production.
6. Décrire architecture recommandée pour intégrer l'inférence (microservice, API REST/WS, batch) avec schémas simples.
7. Proposer métriques d'évaluation et jeux de tests pour valider les modèles.

## Questions à poser (si besoin d'infos supplémentaires)
- Quelles sont les tâches IA prioritaires (détection d'alerte, prédiction, segmentation, NLP sur logs, etc.) ?
- Existe-t-il des jeux de données labellisés historiques ? Si oui, où sont-ils stockés ?
- Contraintes infra : GPU dispo ? temps de latence acceptable pour l'inférence ?
- Niveau d'explicabilité requis pour les utilisateurs finaux ?

## Commandes utiles pour démarrer (exemples)
- Lancer le frontend (dans `Smart Building Management App (1)`) :

```bash
cd "Smart Building Management App (1)"
pnpm install    # ou npm install
pnpm dev        # ou npm run dev
```

- Lancer le backend Node :

```bash
cd back
npm install
npm start
```

- Lancer les services Java (Maven) :

```bash
cd auth-service
./mvnw spring-boot:run
# ou en Windows
mvnw.cmd spring-boot:run
```

- Lancer docker-compose si nécessaire :

```bash
docker-compose up --build
```

## Livrables attendus de Claude (format et priorité)
- Document synthétique listant endpoints, fichiers de données, et points d'intégration (1 page).
- Pipeline ETL prototype (scripts Python/Node), avec exemples d'entrée/sortie (prioritaire).
- Minimum viable model (notebook ou service) capable de faire inférence sur un jeu d'exemples.
- Instructions d'intégration front/back et endpoints d'inférence (swagger/openapi préféré).

## Contacts & fichiers à inspecter en priorité
- Frontend: `Smart Building Management App (1)/src/app/components/DashboardViewOccupant.tsx`
- Frontend services: `Smart Building Management App (1)/src/services/api.ts`, `Smart Building Management App (1)/src/services/websocket.ts`, `Smart Building Management App (1)/src/hooks/useRealtimeData.ts`
- Backend Node: `back/index.js`, `back/package.json`
- Données: `recupp_donnees/data/mapping_final.json`, fichiers `*.ifc` dans `recupp_donnees/data/`
- Services Java: `alert-service/src/main/java/`, `auth-service/src/main/java/`, et leurs `application.properties` dans `resources/`.

---

