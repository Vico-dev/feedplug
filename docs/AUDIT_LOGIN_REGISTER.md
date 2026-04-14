# Audit Login & Register – FeedPlug

## Résumé

Audit des flux **connexion** et **inscription** (frontend + backend Nest) pour repérer les défauts UX, sécurité et cohérence.

---

## 1. Backend (Nest – `src/modules/auth/`)

### Points corrects
- **Register** : email unique, mot de passe hashé (bcrypt 12), transaction compte + user, slug compte généré.
- **Login** : vérification mot de passe, statut `ACTIVE`, mise à jour `lastLoginAt`.
- **DTO** : `class-validator` sur RegisterDto (email, MinLength 8, firstName, lastName, accountName).
- **ValidationPipe** global : `whitelist`, `forbidNonWhitelisted`, `transform`.
- **Refresh token** : stocké en Redis, vérifié au refresh.
- **Logout** : suppression du refresh token en Redis.

### Défaillances identifiées

| Problème | Gravité | Détail |
|----------|---------|--------|
| **LoginDto sans @IsNotEmpty() sur password** | Moyenne | Un mot de passe vide peut passer la validation (IsEmail + IsString). |
| **Register : pas de règle de complexité mot de passe** | Faible | Seul `MinLength(8)`. `acceptInvitation` exige majuscule + chiffre, pas register. |
| **Pas de rate limiting sur login/register** | Moyenne | Risque brute-force / abus (à ajouter au niveau Nest ou reverse proxy). |
| **Messages d’erreur génériques** | Faible | Login : "Email ou mot de passe incorrect" (pas de fuite d’info, OK). |

---

## 2. Frontend – Pages Login & Register

### Points corrects
- Gestion des erreurs avec plusieurs sources (`error.message`, `error.response?.data?.message`).
- États de chargement (bouton désactivé, "Connexion...", "Inscription...").
- Lien "Mot de passe oublié" sur la page login.
- Google Auth optionnel avec `hasGoogleAuth`.
- Confirmation mot de passe côté register (égalité).

### Défaillances identifiées

| Problème | Gravité | Détail |
|----------|---------|--------|
| **Erreurs API : `message` peut être un tableau** | Moyenne | Nest renvoie `message: string[]` en 400. L’apiClient met `data?.message` tel quel → affichage "[object Object]" ou liste brute. |
| **Liens en `<a href>` au lieu de `<Link>`** | Faible | Login/register/forgot-password utilisent des rechargements complets. Mieux : `next/link` pour SPA. |
| **Pas de validation côté client sur le mot de passe (register)** | Moyenne | Pas de `minLength` ni d’indication "8 caractères min". L’utilisateur peut envoyer un mot de passe trop court et voir l’erreur seulement après envoi. |
| **Pas d’`htmlFor` / `id` sur les labels** | Faible | Accessibilité et UX (focus, lecteurs d’écran). |
| **Token : double stockage** | Faible | Cookie + `localStorage`. Redondant mais pas bloquant ; à documenter ou unifier. |
| **Pas de refresh automatique du token** | Moyenne | Quand l’access token expire, aucune tentative de refresh ; l’utilisateur est déconnecté. Pas d’intercepteur 401 → refresh. |
| **Forgot-password selon l’API** | Haute | La page appelle `/auth/forgot-password`. Cette route existe dans `backend-marketing` mais **pas dans l’API Nest**. Si `NEXT_PUBLIC_API_URL` pointe vers Nest, forgot-password renverra 404. |

---

## 3. Client API (`frontend/src/lib/api.ts`)

### Points corrects
- Token dans headers Authorization.
- Gestion CORS, JSON, réponses non-JSON.
- Message d’erreur réseau explicite.

### Défaillances

| Problème | Gravité | Détail |
|----------|---------|--------|
| **Message d’erreur : `data?.message` peut être un tableau** | Moyenne | En 400, normaliser : si `Array.isArray(data.message)` → joindre ou premier élément pour avoir une string. |

---

## 4. Auth Service & Hooks

### Points corrects
- `authService` : login/register/logout, cookie + localStorage, `getCurrentUser` via `/auth/me`.
- `useAuth` : contexte, `useRequireAuth`, `useRequireRole`.

### Défaillances

| Problème | Gravité | Détail |
|----------|---------|--------|
| **`refreshToken` jamais déclenché automatiquement** | Moyenne | En cas de 401, aucune tentative de refresh puis retry. L’utilisateur doit se reconnecter. |
| **Logout : redirection en `window.location.href`** | Faible | OK pour vider l’état, mais à garder en tête pour les tests. |

---

## 5. Recommandations prioritaires

1. **Backend**  
   - Ajouter `@IsNotEmpty()` sur le champ `password` de `LoginDto`.  
   - (Optionnel) Aligner la politique mot de passe de register avec acceptInvitation (majuscule + chiffre) ou documenter la différence.  
   - Ajouter rate limiting sur `POST /auth/login` et `POST /auth/register`.

2. **Frontend**  
   - Dans l’apiClient, normaliser `message` : si tableau → string (join ou premier élément).  
   - Page register : validation côté client (min 8 caractères) + message d’aide sous le champ.  
   - Remplacer les `<a href>` vers login/register/forgot-password par `<Link>` (Next.js).  
   - Associer les labels aux champs (`htmlFor` / `id`).

3. **Forgot-password**  
   - Soit implémenter `POST /auth/forgot-password` (et reset) dans l’API Nest,  
   - Soit s’assurer que l’app front utilise la même base URL que le backend qui expose cette route (ex. backend-marketing).

4. **Optionnel (amélioration)**  
   - Intercepteur 401 : appeler `authService.refreshToken()` puis réessayer la requête ; si refresh échoue, déconnecter et rediriger vers /login.

---

## 6. Fichiers concernés

- Backend : `src/modules/auth/dto/auth.dto.ts`, `auth.service.ts`, `auth.controller.ts`
- Frontend : `frontend/src/app/login/page.tsx`, `frontend/src/app/register/page.tsx`, `frontend/src/lib/auth.ts`, `frontend/src/lib/api.ts`
- Doc : `docs/AUDIT_LOGIN_REGISTER.md` (ce fichier)

---

## 7. Optimisations mises en place (suite à l’audit)

- **Forgot-password + reset-password (Nest)** : routes `POST /auth/forgot-password` et `POST /auth/reset-password` ajoutées dans l’API Nest (AuthService, AuthController, DTOs). Email de reset via `EmailService.sendPasswordResetEmail`. Utile lorsque l’app tourne sur Nest (AppModule).
- **Rate limiting (Nest)** : `ThrottlerGuard` global dans AppModule. Limites dédiées : login 10 req/min, register 5 req/h, forgot-password 5 req/h (décorateurs `@Throttle` sur le contrôleur auth).
- **Refresh token côté frontend** : stockage du `refreshToken` en localStorage après login/register ; envoi dans le body de `POST /auth/refresh`. Intercepteur 401 dans `apiClient` : sur 401 (hors `/auth/refresh`), appel du callback `on401` (refresh), puis retry automatique de la requête une fois. Enregistrement du callback dans `AuthProvider` via `apiClient.setOn401(...)`.
