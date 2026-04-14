# Corriger « Accès bloqué : no registered origin » (Connexion Google)

Lors du clic sur **Continuer avec Google** sur `app.feedplug.com/register`, Google peut afficher :

- **Accès bloqué : erreur d'autorisation**
- **no registered origin**
- **Erreur 401 : invalid_client**

Cela signifie que l’URL d’origine de l’application (`https://app.feedplug.com`) n’est pas autorisée pour votre client OAuth dans la Google Cloud Console.

## Solution : autoriser l’origine dans Google Cloud Console

1. **Ouvrir la Google Cloud Console**  
   [https://console.cloud.google.com](https://console.cloud.google.com)

2. **Sélectionner le bon projet**  
   (celui où a été créé le client OAuth utilisé par FeedPlug, ex. `feedplug-prod` ou le projet lié au client ID `771607738477-...`).

3. **Aller dans APIs & Services → Identifiants**  
   Menu ☰ → **APIs et services** → **Identifiants**.

4. **Ouvrir le client OAuth 2.0 utilisé par l’app**  
   Dans la liste, cliquer sur le **Client ID** de type **Application Web** dont l’ID se termine par `...apps.googleusercontent.com` (le même que `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID`).

5. **Ajouter les origines JavaScript autorisées**  
   Dans la section **Origines JavaScript autorisées** :
   - Cliquer sur **+ AJOUTER UN URI**.
   - Ajouter exactement :  
     `https://app.feedplug.com`
   - Pour le développement local, ajouter aussi :  
     `http://localhost:3000`  
     (et éventuellement `http://127.0.0.1:3000`).

6. **Redirect URI (si demandé)**  
   Pour le flux « Continuer avec Google » (popup / One Tap), seul l’**origine** compte en général. Si vous utilisez aussi un flux avec redirection, ajoutez dans **URI de redirection autorisés** par exemple :  
   `https://app.feedplug.com`  
   ou la page de callback précise (ex. `https://app.feedplug.com/register` selon votre implémentation).

7. **Enregistrer**  
   Cliquer sur **Enregistrer** en bas de la page.

8. **Attendre quelques minutes**  
   Les changements peuvent prendre 1 à 5 minutes à se propager. Réessayer ensuite « Continuer avec Google » sur `https://app.feedplug.com/register`.

## Vérifications complémentaires

- **Même Client ID partout**  
  Le `Client ID` configuré dans la console doit être exactement celui utilisé par le frontend (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) et, côté backend, `GOOGLE_CLIENT_ID` pour la vérification du token.

- **Type de client**  
  Pour « Continuer avec Google » côté navigateur, le client doit être de type **Application Web** (pas « Application de bureau » ou « Application Android »).

- **Pas de typo dans l’origine**  
  L’origine doit être exactement `https://app.feedplug.com` (sans slash final, avec `https`).

Si après ces étapes l’erreur persiste, vérifier qu’aucun proxy ou CDN ne change l’origine (Host / headers) et que l’utilisateur se connecte bien depuis `https://app.feedplug.com`.
