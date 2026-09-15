# VieEnFamille

Application web d'organisation familiale : calendrier, tâches, courses, repas,
événements importants, messages, documents et routines — partagés en temps réel
entre les membres d'une même famille.

Pensée mobile d'abord, utilisable sur tablette et ordinateur, installable sur
l'écran d'accueil.

## Particularité : un seul fichier

Tout le site tient dans `index.html` — structure, styles et logique. C'est un
choix assumé : pas de build, pas de `npm install`, pas d'outillage. On ouvre le
fichier, on le lit, on le déploie.

## Stack

- HTML / CSS / JavaScript, sans dépendance à installer
- Firebase chargé par CDN : Authentication, Firestore (temps réel), Storage
- Déploiement : glisser-déposer du dossier sur Netlify

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Tout le site |
| `firestore.rules` | Règles de sécurité Firestore — à publier dans la console Firebase |
| `storage.rules` | Règles de sécurité Storage — à publier dans la console Firebase |
| `manifest.json`, `icon.svg` | Installation sur écran d'accueil |
| `sw.js` | Service worker : coquille disponible hors connexion |
| `CLAUDE.md` | Documentation technique détaillée (modèle de données, rôles, pièges) |
| `design-system/` | Direction de design de référence |

## Lancer en local

Firebase Auth exige un vrai domaine : ouvrir le fichier en `file://` ne
fonctionne pas.

```bash
python3 -m http.server 8080
```

Puis http://localhost:8080 (`localhost` est autorisé par défaut dans Firebase).

## Rôles

- **Administrateur** — gère les membres, les rôles et le code enfant
- **Membre** — crée et modifie tout le contenu familial
- **Enfant** — sans compte, entre par un code ; peut seulement cocher ses tâches,
  ses courses et ses routines, et n'accède jamais aux documents

Ces restrictions sont appliquées deux fois : dans l'interface, et surtout dans
les règles de sécurité côté serveur.

## Espace Documents et plan Firebase

L'onglet Documents repose sur Firebase Storage, dont l'activation requiert le
plan Blaze depuis fin 2024. Tant qu'il n'est pas activé, cet onglet affiche une
explication et refuse les envois — **le reste de l'application fonctionne
normalement** : calendrier, tâches, courses, repas, routines, messages et
événements ne dépendent que de Firestore.

## Sécurité

La clé API Firebase présente dans `index.html` n'est pas un secret : c'est un
identifiant public de projet, comme le prévoit Firebase pour le web. Ce qui
protège réellement les données, ce sont `firestore.rules` et `storage.rules`.
Toute modification de ces fichiers doit être republiée dans la console Firebase
pour prendre effet.
