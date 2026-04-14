/**
 * FAQ Documentation — partagée entre la page /docs/faq et le schéma FAQPage JSON-LD
 */

export type FaqEntry = {
  q: string;
  a: string;
};

export type FaqSection = {
  category: string;
  items: readonly FaqEntry[];
};

export const FAQ_DOCS: readonly FaqSection[] = [
  {
    category: "Connexion et compte",
    items: [
      {
        q: "J'ai oublié mon mot de passe.",
        a: "Utilisez le lien « Mot de passe oublié » sur la page de connexion. Un email vous permettra de définir un nouveau mot de passe. Vérifiez les spams si vous ne le recevez pas.",
      },
      {
        q: "La connexion Google ne fonctionne pas.",
        a: "Vérifiez que les pop-ups ne sont pas bloqués pour le domaine FeedPlug. Essayez en navigation privée ou avec un autre navigateur. Si le problème persiste, contactez le support.",
      },
    ],
  },
  {
    category: "Sources et synchronisation",
    items: [
      {
        q: "La connexion Shopify échoue ou se déconnecte.",
        a: "Shopify peut révoquer l'accès si le token expire ou si l'app est désinstallée. Reconnectez la source depuis FeedPlug (Sources) en suivant à nouveau l'authentification Shopify. Vérifiez que l'app FeedPlug est bien installée dans votre boutique Shopify.",
      },
      {
        q: "Ma synchro ne se lance pas ou reste bloquée.",
        a: "Vérifiez que la source est bien configurée et que l'URL ou le fichier est accessible. Pour Shopify, assurez-vous que la connexion est active. En cas d'erreur affichée, lisez le message (ex. fichier trop volumineux, format non reconnu) et corrigez la source ou relancez.",
      },
      {
        q: "Quels formats de fichier sont acceptés pour l'import ?",
        a: "FeedPlug accepte les fichiers CSV et les exports type tableur (XLSX selon configuration). Vous pouvez fournir une URL de fichier ou un glisser-déposer. Les colonnes sont reconnues et mappées automatiquement vers les champs produit ; vous pouvez ajuster le mapping si besoin.",
      },
    ],
  },
  {
    category: "Score et catalogue",
    items: [
      {
        q: "Le score ne s'affiche pas ou ne se met pas à jour.",
        a: "Le score est calculé après synchronisation. Lancez une synchro puis consultez le catalogue ; les scores peuvent prendre quelques instants à s'afficher. Si un produit n'a pas de score, vérifiez qu'il dispose au minimum des champs obligatoires (titre, description, image, prix).",
      },
      {
        q: "Comment interpréter un score faible ?",
        a: "Un score global < 70 indique des priorités d'amélioration. Consultez le détail par dimension (conformité, qualité, SEO, conversion) et les recommandations sur la fiche produit. La dimension Conformité < 70 peut entraîner le rejet par Google — corrigez en priorité les champs manquants ou invalides.",
      },
    ],
  },
  {
    category: "Export et Google Merchant Center",
    items: [
      {
        q: "Mon produit est rejeté par Google (GMC). Que faire ?",
        a: "Google rejette souvent pour champs manquants ou invalides : titre trop long ou avec caractères interdits, image absente ou non HTTPS, prix ou disponibilité invalides, condition manquante, etc. Consultez le score FeedPlug (dimension Conformité) et les recommandations ; corrigez les champs indiqués en source ou via l'enrichissement IA, puis relancez une synchro et un export.",
      },
      {
        q: "Le flux ne se met pas à jour dans Google Merchant Center.",
        a: "GMC récupère le flux à l'URL que vous avez renseignée. Vérifiez que l'URL du flux dans FeedPlug est bien celle enregistrée dans GMC. Lancez une mise à jour du catalogue et de l'export dans FeedPlug ; GMC peut mettre quelques minutes à re-télécharger le fichier selon votre configuration de récupération.",
      },
      {
        q: "Quel format ont les flux exportés ?",
        a: "Les flux pour Google Merchant Center sont générés au format attendu par Google (XML type Merchant Center). Les téléchargements pour d'autres canaux peuvent être en CSV ou autre format selon l'option choisie. Le contenu respecte les champs requis et recommandés pour chaque canal.",
      },
    ],
  },
  {
    category: "Enrichissement IA",
    items: [
      {
        q: "Comment est facturé l'enrichissement IA ?",
        a: "L'utilisation de l'IA est facturée selon votre offre (par nombre de champs optimisés ou forfait). La consommation est visible dans votre compte. Les produits déjà optimisés ou avec un bon score peuvent être exclus pour limiter les coûts.",
      },
      {
        q: "Puis-je annuler ou revenir en arrière après une optimisation IA ?",
        a: "Les propositions sont prévisualisables avant enregistrement. Une fois enregistrées, les nouvelles valeurs remplacent les anciennes dans le catalogue FeedPlug. Pour revenir en arrière, vous devez soit modifier manuellement la fiche, soit relancer une synchro depuis la source si les données d'origine n'ont pas été modifiées côté Shopify ou fichier.",
      },
    ],
  },
] as const;

/** Liste à plat pour le schéma FAQPage (toutes les Q&R) */
export const FAQ_DOCS_FLAT: readonly FaqEntry[] = FAQ_DOCS.flatMap((s) => s.items);
