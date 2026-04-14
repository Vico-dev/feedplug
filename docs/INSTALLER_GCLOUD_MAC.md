# Installer gcloud sur Mac (quand Homebrew échoue)

Si `brew install --cask google-cloud-sdk` échoue avec :
`ERROR: Provided python path /opt/homebrew/opt/python@3.13/libexec/bin/python3 does not exist`,
le cask force un chemin Python qui n’existe plus. Utilisez l’**installateur officiel** (sans Homebrew).

---

## Méthode 1 : Installateur officiel (recommandé)

1. **Lancer l’installateur** (télécharge et installe dans `~/google-cloud-sdk`) :
   ```bash
   curl https://sdk.cloud.google.com | bash
   ```

2. **Charger gcloud dans le shell** (à faire à chaque nouveau terminal, ou ajouter dans `~/.zshrc`) :
   ```bash
   source ~/google-cloud-sdk/path.zsh.inc
   source ~/google-cloud-sdk/completion.zsh.inc   # optionnel : autocomplétion
   ```
   Pour que ce soit permanent :
   ```bash
   echo 'source ~/google-cloud-sdk/path.zsh.inc' >> ~/.zshrc
   echo 'source ~/google-cloud-sdk/completion.zsh.inc' >> ~/.zshrc
   source ~/.zshrc
   ```

3. **Vérifier** :
   ```bash
   gcloud --version
   ```

4. Si besoin, (re)configurer le projet et la connexion :
   ```bash
   gcloud init
   ```

---

## Méthode 2 : Réparer le chemin Python pour que le cask Homebrew marche

Le cask attend Python ici : `/opt/homebrew/opt/python@3.13/libexec/bin/python3`.  
Tu peux créer ce chemin en lien symbolique vers ton Python Homebrew :

```bash
sudo mkdir -p /opt/homebrew/opt/python@3.13/libexec/bin
sudo ln -sf /opt/homebrew/bin/python3 /opt/homebrew/opt/python@3.13/libexec/bin/python3
```

Ensuite réinstaller le cask :

```bash
brew install --cask google-cloud-sdk
```

Puis ajouter gcloud au PATH (le cask le met dans `/opt/homebrew/share/google-cloud-sdk/bin`) :

```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
echo 'export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"' >> ~/.zshrc
```

---

En résumé : en cas d’échec du cask, privilégier **Méthode 1** (installateur officiel).
