# Politique de Sécurité — FACAM PERFORMER

## Architecture de sécurité

### Outils en place

| Outil | Catégorie | Déclenchement |
|-------|-----------|---------------|
| **CodeQL** | SAST — Analyse statique du code | Push main/staging + PR + hebdomadaire |
| **npm audit** | SCA — Analyse des dépendances (CVE) | Push main/staging + PR |
| **Gitleaks** | Secret Scanning | Push main/staging + PR |
| **Dependabot** | Mises à jour automatiques | Hebdomadaire (lundi) |
| **ESLint** | Qualité & sécurité du code | Chaque push / PR |

---

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique pour une faille de sécurité.**

Envoyez un email à : **[votre-email@facamstairwaytogo.com]**

Merci d'inclure :
- Description de la vulnérabilité
- Étapes pour la reproduire
- Impact potentiel
- Version ou branche concernée

Nous nous engageons à répondre dans les **48 heures** ouvrées.

---

## Variables d'environnement requises

### GitHub Secrets (Settings → Secrets and variables → Actions)

```
# Supabase — variables d'environnement Vite
VITE_SUPABASE_URL          URL de votre projet Supabase
VITE_SUPABASE_ANON_KEY     Clé anonyme Supabase (publique)

# Vercel — déploiement
VERCEL_TOKEN               Token API Vercel (Settings → Tokens)
VERCEL_ORG_ID              ID de l'organisation Vercel
VERCEL_PROJECT_ID          ID du projet Vercel

# Codecov — rapport de couverture (optionnel)
CODECOV_TOKEN              Token Codecov (gratuit pour repos publics)

# Gitleaks — scan de secrets (optionnel pour repos publics)
GITLEAKS_LICENSE           Licence Gitleaks (plan gratuit disponible)
```

### GitHub Environments (Settings → Environments)

Créer deux environments :

**`production`**
- Required reviewers : activé (approbation manuelle recommandée)
- Deployment branches : `main` uniquement
- Secrets : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**`staging`**
- Required reviewers : désactivé
- Deployment branches : `staging` uniquement
- Secrets : variables de staging

---

## Protection des branches (à configurer manuellement)

### Branche `main` (production)

Aller dans : **Settings → Branches → Add branch ruleset**

```
Nom : main-protection
Branches : main

✅ Require a pull request before merging
   - Required approvals : 1
   - Dismiss stale reviews : activé

✅ Require status checks to pass before merging
   - Lint & TypeScript
   - Tests & Couverture ≥ 70%
   - Build Vite
   - SAST — CodeQL
   - SCA — Audit des dépendances
   - Secret Scan — Gitleaks

✅ Require branches to be up to date
✅ Require conversation resolution
✅ Do not allow bypassing the above settings
✅ Block force pushes
✅ Restrict deletions
```

### Branche `staging`

```
Nom : staging-protection
Branches : staging

✅ Require status checks to pass
   - Lint & TypeScript
   - Tests & Couverture ≥ 70%
   - Build Vite

✅ Block force pushes
```

### Branche `dev`

```
Nom : dev-protection
Branches : dev

✅ Require status checks to pass
   - Lint & TypeScript
   - Build Vite
```

---

## Bonnes pratiques appliquées

- **Aucun secret dans le code** — toutes les clés via variables d'environnement
- **Couverture de tests ≥ 70%** — bloquant en CI
- **npm audit critique** — bloquant en CI
- **CodeQL** — résultats visibles dans Security → Code scanning
- **Dependabot** — PRs automatiques chaque lundi pour les dépendances mineures/majeures
- **CODEOWNERS** — revue obligatoire pour les fichiers sensibles
