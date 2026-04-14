import type { ComparisonLandingCopy } from "@/components/marketing/ComparisonLanding";
import type { LPMetaConfig } from "@/lib/lp-metadata";

type Locale = "fr" | "en" | "es";

type ComparisonPageDefinition = {
  meta: LPMetaConfig;
  copy: Record<Locale, ComparisonLandingCopy>;
};

export const comparisonPages = {
  channable: {
    meta: {
      path: "/feedplug-vs-channable",
      fr: {
        title: "FeedPlug vs Channable | Alternative plus simple pour vos flux produits",
        description:
          "Comparez FeedPlug et Channable pour vos flux produits. FeedPlug se positionne sur la simplicite, le scoring produit, l'audit de catalogue et la preparation des canaux IA.",
        keywords: [
          "feedplug vs channable",
          "alternative channable",
          "outil flux produits simple",
          "comparatif channable",
          "gestion flux produits",
          "feed produits chatgpt",
        ],
      },
      en: {
        title: "FeedPlug vs Channable | A simpler product feed alternative",
        description:
          "Compare FeedPlug and Channable for product feed management. FeedPlug focuses on faster activation, product scoring, catalog audits, and AI-ready feed preparation.",
        keywords: [
          "feedplug vs channable",
          "channable alternative",
          "simple product feed tool",
          "product feed comparison",
          "catalog audit tool",
          "chatgpt product feed",
        ],
      },
      es: {
        title: "FeedPlug vs Channable | Alternativa mas simple para feeds de producto",
        description:
          "Compara FeedPlug y Channable para la gestion de feeds de producto. FeedPlug destaca por simplicidad, scoring de producto, auditoria de catalogo y preparacion para asistentes IA.",
        keywords: [
          "feedplug vs channable",
          "alternativa channable",
          "herramienta feed productos",
          "comparativa channable",
          "scoring de producto",
          "feed chatgpt",
        ],
      },
      breadcrumbNameFr: "FeedPlug vs Channable",
      breadcrumbNameEn: "FeedPlug vs Channable",
      breadcrumbNameEs: "FeedPlug vs Channable",
      howToNameFr: "Comment choisir entre FeedPlug et Channable",
      howToNameEn: "How to choose between FeedPlug and Channable",
      howToNameEs: "Como elegir entre FeedPlug y Channable",
      howToDescFr:
        "Guide pour comparer FeedPlug et Channable selon la complexite attendue, la vitesse de mise en place et la preparation des flux produits pour les canaux IA.",
      howToDescEn:
        "Guide to compare FeedPlug and Channable based on setup complexity, time to value, and AI-ready feed preparation.",
      howToDescEs:
        "Guia para comparar FeedPlug y Channable segun complejidad, tiempo de activacion y preparacion del feed para canales IA.",
      steps: [
        {
          nameFr: "Lister vos besoins reels",
          nameEn: "List your actual needs",
          nameEs: "Lista tus necesidades reales",
          textFr:
            "Identifiez si vous cherchez surtout un outil rapide pour nettoyer, scorer et diffuser un catalogue, ou une suite plus lourde de gestion de regles.",
          textEn:
            "Decide whether you mainly need a fast tool to clean, score, and distribute a catalog, or a heavier rules-focused suite.",
          textEs:
            "Define si necesitas sobre todo una herramienta rapida para limpiar, puntuar y difundir un catalogo, o una suite mas pesada centrada en reglas.",
        },
        {
          nameFr: "Comparer la mise en route",
          nameEn: "Compare the onboarding path",
          nameEs: "Compara la puesta en marcha",
          textFr:
            "Regardez le temps de configuration, la clarte de l'interface et la capacite a faire sortir un premier flux propre rapidement.",
          textEn:
            "Compare setup time, interface clarity, and the ability to publish a clean first feed quickly.",
          textEs:
            "Compara el tiempo de configuracion, la claridad de la interfaz y la rapidez para publicar un primer feed limpio.",
        },
        {
          nameFr: "Evaluer la qualite catalogue",
          nameEn: "Evaluate catalog quality workflows",
          nameEs: "Evalua la calidad del catalogo",
          textFr:
            "Verifiez si la solution aide a prioriser les fiches faibles, a auditer le catalogue et a preparer les canaux IA sans exports fragiles.",
          textEn:
            "Check whether the tool helps prioritize weak listings, audit the catalog, and prepare AI channels without fragile custom exports.",
          textEs:
            "Revisa si la solucion ayuda a priorizar fichas debiles, auditar el catalogo y preparar canales IA sin exportaciones fragiles.",
        },
      ],
    },
    copy: {
      fr: {
        backLabel: "Retour a l'accueil",
        eyebrow: "Comparatif FeedPlug vs Channable",
        title: "FeedPlug vs Channable : quelle solution choisir pour des flux produits plus simples ?",
        subtitle:
          "Channable est reconnu pour sa puissance, surtout quand il faut empiler des regles et des cas complexes. FeedPlug prend l'angle inverse : aller vite, rendre le catalogue lisible, scorer les fiches et publier des flux propres pour Google Shopping, marketplaces et assistants IA.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Demander une demo",
        secondaryHref: "/feed-produit-chatgpt",
        secondaryLabel: "Voir le feed ChatGPT",
        heroStats: [
          { value: "15 min", label: "Premiere mise en route visee", detail: "Pensé pour sortir un premier flux propre sans chantier technique lourd." },
          { value: "1 score / 100", label: "Lecture qualite catalogue", detail: "Chaque fiche produit peut etre priorisee avant diffusion." },
          { value: "Google + IA", label: "Canaux cibles", detail: "Google Shopping, marketplaces et nouvelles surfaces de decouverte IA." },
        ],
        asideEyebrow: "En bref",
        quickTitle: "Ou FeedPlug prend l'avantage",
        quickIntro:
          "Si votre sujet principal est de rendre un catalogue plus propre, plus actionnable et plus diffusable sans usine a gaz, FeedPlug couvre ce besoin plus directement.",
        quickBullets: [
          "Positionnement plus net sur la simplicite et la vitesse de prise en main.",
          "Score produit et audit de flux pour prioriser les corrections au lieu de naviguer a l'aveugle.",
          "Pages et discours deja orientes ChatGPT, assistants IA et catalogues LLM-ready.",
        ],
        fitTitle: "Pour quel type d'equipe ?",
        fitIntro:
          "Les deux approches ne servent pas exactement les memes contextes. L'important est de choisir en fonction du niveau de complexite reel de votre catalogue et de votre capacite a maintenir des regles dans le temps.",
        feedplugTitle: "FeedPlug convient mieux si...",
        feedplugBullets: [
          "vous cherchez un outil plus lisible pour une equipe e-commerce ou marketing, sans dependre d'un expert feed a plein temps",
          "votre priorite est de corriger vite les fiches faibles, sortir un flux propre et mieux voir ou vous perdez du chiffre",
          "vous voulez preparer le catalogue pour Google Shopping, marketplaces et assistants IA depuis une meme base",
        ],
        otherTitle: "Channable convient mieux si...",
        otherBullets: [
          "vous avez deja une logique tres poussee de regles et de projets multi-clients a maintenir dans un outil plus dense",
          "vous acceptez une phase d'appropriation plus lourde en echange d'une grande profondeur fonctionnelle",
          "votre equipe sait deja travailler dans une interface plus complexe et tres orientee parametrage",
        ],
        tableTitle: "Comparatif rapide",
        tableIntro:
          "Ce tableau ne cherche pas a forcer la comparaison. Il aide surtout a voir si vous avez besoin d'une plateforme plus lourde de parametrage ou d'un outil plus direct pour nettoyer et diffuser vos flux.",
        tableFirstColumnLabel: "Critere",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Channable",
        },
        rows: [
          {
            label: "Positionnement",
            feedplug: "Simplicite, audit de flux, scoring produit, diffusion multi-canal et preparation IA.",
            other: "Suite de gestion feed plus large, souvent choisie pour des setups tres pilotes par les regles.",
          },
          {
            label: "Mise en route",
            feedplug: "Vise une premiere valeur rapide, avec un catalogue central et un score lisible.",
            other: "Peut demander plus de temps d'appropriation selon le volume de regles et de projets.",
          },
          {
            label: "Lecture qualite catalogue",
            feedplug: "Score sur 100, audit de flux et priorisation des fiches a corriger.",
            other: "Logique plus outillee sur la transformation, moins centree sur une lecture simple du niveau de qualite global.",
          },
          {
            label: "Canaux IA",
            feedplug: "Pages et promesse explicites autour de ChatGPT, assistants IA et feed exploitable par les LLM.",
            other: "Peut couvrir des besoins connexes, mais l'angle marketing principal n'est pas centre sur ce sujet.",
          },
          {
            label: "Lisibilite quotidienne",
            feedplug: "Cherche a reduire le nombre d'ecrans et a rendre les arbitrages evidents pour l'equipe.",
            other: "Plus de profondeur mais aussi plus de densite pour les equipes moins expertes.",
          },
          {
            label: "Tarification percue",
            feedplug: "Positionnement plus simple a lire avec une promesse claire sur ce qui est inclus.",
            other: "Le cout final depend souvent davantage du perimetre, du volume et du niveau d'accompagnement.",
          },
        ],
        proofTitle: "Pourquoi cette page est utile pour le SEO/GEO",
        proofCards: [
          {
            title: "Comparer avec des faits, pas avec du flou",
            body: "Les moteurs et les IA citent plus facilement une page qui explique ou chaque outil est fort, plutot qu'une promesse vague du type 'on est meilleur partout'.",
          },
          {
            title: "Nommer clairement l'alternative",
            body: "Si vous voulez apparaitre sur des prompts comme 'alternative a Channable', il faut une page qui assume explicitement cette requete et la traite proprement.",
          },
          {
            title: "Raccrocher la comparaison a des preuves produit",
            body: "Le scoring produit, l'audit de flux et la preparation ChatGPT donnent a FeedPlug un angle plus distinctif qu'un simple discours 'nous faisons aussi des feeds'.",
          },
          {
            title: "Transformer un prompt IA en intention commerciale",
            body: "Quelqu'un qui demande une alternative a Channable a deja un cadre d'achat. Cette page aide a capter cette intention avec un message plus simple et plus concret.",
          },
        ],
        faqTitle: "Questions frequentes",
        faqIntro:
          "Ces questions reviennent souvent quand une equipe e-commerce cherche une alternative plus simple a Channable.",
        faqs: [
          {
            question: "FeedPlug remplace-t-il Channable dans tous les cas ?",
            answer:
              "Non. Si vous avez un environnement tres pousse en regles et un niveau de complexite deja assume par l'equipe, Channable peut rester pertinent. FeedPlug est surtout plus fort quand l'enjeu est de gagner en clarte, en vitesse et en lisibilite catalogue.",
          },
          {
            question: "Quel est le vrai angle de FeedPlug face a Channable ?",
            answer:
              "Le coeur du positionnement est plus simple : un catalogue central, un audit de flux, un score produit, des priorites de correction et une diffusion multi-canal qui parle aussi aux usages IA emergents.",
          },
          {
            question: "Pourquoi creer une page 'FeedPlug vs Channable' ?",
            answer:
              "Parce que les moteurs et les assistants IA ont besoin d'une page explicite pour comprendre le cadre de comparaison. Sans cela, FeedPlug a moins de chances d'etre cite sur les requetes alternatives.",
          },
          {
            question: "Est-ce pertinent si je vends aussi sur ChatGPT ou d'autres assistants IA ?",
            answer:
              "Oui. FeedPlug a deja un contenu marketing dedie a la preparation de feeds pour ChatGPT et aux surfaces IA, ce qui donne un meilleur angle de citabilite que des pages plus generiques.",
          },
        ],
        relatedTitle: "Pages a lier juste apres",
        relatedLinks: [
          {
            href: "/comparatif-outils-feed-produits",
            label: "Comparatif outils de feed produits",
            body: "Une vue plus large pour capter les requetes 'meilleur outil feed produits' et les prompts de recommandation globale.",
          },
          {
            href: "/feedplug-vs-shoppingfeed",
            label: "FeedPlug vs Shoppingfeed",
            body: "Une comparaison plus orientee marketplaces, operations et diffusion catalogue.",
          },
          {
            href: "/feed-produit-chatgpt",
            label: "Feed produit ChatGPT",
            body: "Le bon prolongement pour prouver l'angle IA et la preparation du catalogue pour les LLM.",
          },
          {
            href: "/audit-flux",
            label: "Audit de flux",
            body: "Une page plus conversion pour transformer l'intention comparative en audit concret du catalogue.",
          },
        ],
        ctaTitle: "Vous voulez une alternative a Channable plus simple a deployer ?",
        ctaBody:
          "Le bon test n'est pas de comparer des listes de fonctionnalites abstraites. Il faut regarder si votre equipe peut comprendre le catalogue, prioriser les corrections et publier un flux propre sans surcouche inutile.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Parler de votre catalogue",
      },
      en: {
        backLabel: "Back to home",
        eyebrow: "FeedPlug vs Channable comparison",
        title: "FeedPlug vs Channable: which option fits a simpler product feed workflow?",
        subtitle:
          "Channable is known for depth and rule-heavy workflows. FeedPlug takes a different angle: faster activation, clearer catalog quality signals, product scoring, and cleaner feed publishing for Google Shopping, marketplaces, and AI assistants.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Request a demo",
        secondaryHref: "/feed-produit-chatgpt",
        secondaryLabel: "See the ChatGPT feed page",
        heroStats: [
          { value: "15 min", label: "Target time to first value", detail: "Built to get a first clean feed live without a heavy technical project." },
          { value: "1 score / 100", label: "Catalog quality reading", detail: "Each product listing can be prioritized before distribution." },
          { value: "Google + AI", label: "Target surfaces", detail: "Google Shopping, marketplaces, and emerging AI discovery channels." },
        ],
        asideEyebrow: "At a glance",
        quickTitle: "Where FeedPlug has the edge",
        quickIntro:
          "If your main job is to make the catalog cleaner, easier to act on, and easier to distribute without operational overload, FeedPlug addresses that need more directly.",
        quickBullets: [
          "Clearer positioning around simplicity and faster onboarding.",
          "Product scoring and feed audits that help prioritize fixes instead of guessing.",
          "Existing content and product language already aligned with ChatGPT, AI assistants, and LLM-ready catalogs.",
        ],
        fitTitle: "Which team is each tool better for?",
        fitIntro:
          "The decision is less about who has the longest feature list and more about the actual complexity of your workflow and your team's ability to maintain rules over time.",
        feedplugTitle: "FeedPlug is a better fit if...",
        feedplugBullets: [
          "you want a clearer tool for e-commerce or marketing teams without needing a dedicated feed specialist",
          "your priority is to fix weak listings quickly, ship a clean feed, and understand where revenue is being lost",
          "you want one catalog base that can serve Google Shopping, marketplaces, and AI assistants",
        ],
        otherTitle: "Channable is a better fit if...",
        otherBullets: [
          "you already run a very rules-heavy setup and are comfortable maintaining that complexity",
          "you accept a denser learning curve in exchange for a broader configuration layer",
          "your team already works comfortably inside a more technical feed management environment",
        ],
        tableTitle: "Quick comparison",
        tableIntro:
          "This page is not meant to flatten both tools into the same box. It helps clarify whether you need a heavier rule engine or a more direct workflow to clean and distribute product data.",
        tableFirstColumnLabel: "Criteria",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Channable",
        },
        rows: [
          {
            label: "Positioning",
            feedplug: "Simplicity, feed audits, product scoring, multi-channel publishing, and AI-ready catalog work.",
            other: "A broader feed management suite often chosen for more rule-driven environments.",
          },
          {
            label: "Onboarding",
            feedplug: "Optimized for faster first value with a centralized catalog and visible quality score.",
            other: "Can require more onboarding time depending on projects and rule depth.",
          },
          {
            label: "Catalog quality visibility",
            feedplug: "Score out of 100, catalog audit, and prioritization of weak listings.",
            other: "More transformation-focused, with less emphasis on a simple global quality reading.",
          },
          {
            label: "AI channels",
            feedplug: "Explicit positioning around ChatGPT, AI assistants, and LLM-usable feeds.",
            other: "Can support adjacent needs, but that is not the central angle of the platform story.",
          },
          {
            label: "Daily usability",
            feedplug: "Designed to reduce navigation overhead and make next actions easier to see.",
            other: "More depth, but also more density for less specialized teams.",
          },
          {
            label: "Pricing perception",
            feedplug: "Simpler value story and clearer inclusion logic.",
            other: "Final cost is often more tied to scope, volume, and service layering.",
          },
        ],
        proofTitle: "Why this page matters for SEO and GEO",
        proofCards: [
          {
            title: "It gives search engines a clear comparison frame",
            body: "Recommendation engines and AI answers are more likely to cite a page that clearly states when each option makes sense.",
          },
          {
            title: "It explicitly targets the alternative query",
            body: "If you want to win prompts such as 'Channable alternative', the site needs a page that names that search intent directly.",
          },
          {
            title: "It ties the argument back to product proof",
            body: "Product scoring, feed audits, and ChatGPT-ready catalog work make the positioning more concrete than generic feed-tool copy.",
          },
          {
            title: "It captures late-stage demand",
            body: "Someone asking for a Channable alternative is already evaluating tools. This page translates that intent into a cleaner buying narrative.",
          },
        ],
        faqTitle: "Frequently asked questions",
        faqIntro:
          "These questions come up when a team is actively looking for a simpler alternative to Channable.",
        faqs: [
          {
            question: "Does FeedPlug replace Channable in every scenario?",
            answer:
              "No. If your organization already runs a highly rule-driven setup and is comfortable maintaining that complexity, Channable may still be a strong fit. FeedPlug is stronger when clarity, speed, and catalog visibility matter most.",
          },
          {
            question: "What is FeedPlug's clearest advantage against Channable?",
            answer:
              "A simpler workflow: one catalog layer, a feed audit, product scoring, clear fix priorities, and a distribution story that also speaks to emerging AI channels.",
          },
          {
            question: "Why create a dedicated 'FeedPlug vs Channable' page?",
            answer:
              "Because search engines and AI assistants need an explicit comparison page to understand the alternative intent. Without that, FeedPlug has fewer opportunities to be cited.",
          },
          {
            question: "Is this relevant if AI product discovery matters to us?",
            answer:
              "Yes. FeedPlug already has dedicated content around ChatGPT feeds and AI assistant distribution, which strengthens its relevance for that use case.",
          },
        ],
        relatedTitle: "Pages to connect next",
        relatedLinks: [
          {
            href: "/comparatif-outils-feed-produits",
            label: "Product feed software comparison",
            body: "A broader guide to capture prompts like 'best product feed tool' and recommendation-oriented searches.",
          },
          {
            href: "/feedplug-vs-shoppingfeed",
            label: "FeedPlug vs Shoppingfeed",
            body: "A more marketplace-oriented comparison for teams evaluating operational depth versus feed clarity.",
          },
          {
            href: "/feed-produit-chatgpt",
            label: "ChatGPT product feed",
            body: "The best follow-up page to support the AI-ready catalog angle with concrete content.",
          },
          {
            href: "/audit-flux",
            label: "Feed audit",
            body: "A conversion-oriented next step for teams that want to evaluate their current catalog quality quickly.",
          },
        ],
        ctaTitle: "Need a simpler alternative to Channable?",
        ctaBody:
          "The useful comparison is not who can list the most features. It is whether your team can understand the catalog, prioritize fixes, and publish a clean feed without unnecessary operational drag.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Talk through your catalog",
      },
      es: {
        backLabel: "Volver al inicio",
        eyebrow: "Comparativa FeedPlug vs Channable",
        title: "FeedPlug vs Channable: que opcion encaja mejor con un flujo de feeds mas simple?",
        subtitle:
          "Channable destaca por profundidad y logicas de reglas complejas. FeedPlug toma otro angulo: activacion mas rapida, mejor lectura de calidad del catalogo, scoring de producto y publicacion mas limpia para Google Shopping, marketplaces y asistentes IA.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Solicitar una demo",
        secondaryHref: "/feed-produit-chatgpt",
        secondaryLabel: "Ver la pagina ChatGPT",
        heroStats: [
          { value: "15 min", label: "Tiempo objetivo a primer valor", detail: "Pensado para publicar un primer feed limpio sin proyecto tecnico pesado." },
          { value: "1 score / 100", label: "Lectura de calidad", detail: "Cada ficha puede priorizarse antes de difundirla." },
          { value: "Google + IA", label: "Canales objetivo", detail: "Google Shopping, marketplaces y nuevas superficies IA." },
        ],
        asideEyebrow: "Resumen",
        quickTitle: "Donde FeedPlug destaca",
        quickIntro:
          "Si tu prioridad es volver el catalogo mas limpio, accionable y facil de difundir sin sobrecarga operativa, FeedPlug responde a ese objetivo de forma mas directa.",
        quickBullets: [
          "Posicionamiento mas claro en simplicidad y velocidad de adopcion.",
          "Scoring de producto y auditoria de feed para priorizar correcciones sin ir a ciegas.",
          "Contenido ya alineado con ChatGPT, asistentes IA y catalogos listos para LLM.",
        ],
        fitTitle: "Para que tipo de equipo sirve mejor?",
        fitIntro:
          "La decision depende menos de quien tiene mas funciones y mas de la complejidad real del flujo y de la capacidad del equipo para mantener reglas en el tiempo.",
        feedplugTitle: "FeedPlug encaja mejor si...",
        feedplugBullets: [
          "quieres una herramienta mas clara para e-commerce o marketing sin depender de un especialista feed a tiempo completo",
          "tu prioridad es corregir fichas debiles rapido, publicar un feed limpio y entender donde pierdes ventas",
          "quieres una base unica para Google Shopping, marketplaces y asistentes IA",
        ],
        otherTitle: "Channable encaja mejor si...",
        otherBullets: [
          "ya operas un entorno muy basado en reglas y aceptas mantener esa complejidad",
          "asumes una curva de aprendizaje mas densa a cambio de mas profundidad de configuracion",
          "tu equipo ya trabaja comodo dentro de una capa tecnica de gestion de feeds",
        ],
        tableTitle: "Comparativa rapida",
        tableIntro:
          "La idea no es meter ambas herramientas en la misma caja, sino aclarar si necesitas un motor de reglas mas pesado o un flujo mas directo para limpiar y difundir datos de producto.",
        tableFirstColumnLabel: "Criterio",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Channable",
        },
        rows: [
          {
            label: "Posicionamiento",
            feedplug: "Simplicidad, auditoria de feeds, scoring de producto, publicacion multicanal y preparacion IA.",
            other: "Suite mas amplia de gestion de feeds, habitual en entornos muy guiados por reglas.",
          },
          {
            label: "Puesta en marcha",
            feedplug: "Pensado para llegar rapido al primer valor con un catalogo central y una puntuacion visible.",
            other: "Puede requerir mas tiempo de adopcion segun proyectos y reglas.",
          },
          {
            label: "Visibilidad de calidad",
            feedplug: "Score sobre 100, auditoria del catalogo y priorizacion de fichas debiles.",
            other: "Mas centrado en transformacion, menos en una lectura global simple de calidad.",
          },
          {
            label: "Canales IA",
            feedplug: "Posicionamiento explicito en ChatGPT, asistentes IA y feeds usables por LLM.",
            other: "Puede cubrir necesidades cercanas, pero no es su angulo principal.",
          },
          {
            label: "Uso diario",
            feedplug: "Busca reducir friccion y hacer mas evidentes las acciones siguientes.",
            other: "Mas profundidad, pero tambien mas densidad para equipos menos especializados.",
          },
          {
            label: "Percepcion de precio",
            feedplug: "Historia de valor mas simple y facil de leer.",
            other: "El coste final depende mas del alcance, volumen y servicios asociados.",
          },
        ],
        proofTitle: "Por que esta pagina ayuda al SEO y GEO",
        proofCards: [
          {
            title: "Da un marco comparativo claro",
            body: "Motores de busqueda y asistentes IA citan mejor una pagina que explica cuando cada opcion tiene sentido.",
          },
          {
            title: "Ataca la consulta de alternativa",
            body: "Si quieres ganar prompts como 'alternativa a Channable', necesitas una URL que nombre esa intencion de forma directa.",
          },
          {
            title: "Ancla el mensaje en pruebas de producto",
            body: "Scoring de producto, auditoria de feed y preparacion ChatGPT hacen que el posicionamiento sea mas concreto.",
          },
          {
            title: "Captura demanda mas cercana a compra",
            body: "Quien busca una alternativa a Channable ya esta comparando herramientas. Esta pagina convierte esa intencion en relato comercial claro.",
          },
        ],
        faqTitle: "Preguntas frecuentes",
        faqIntro:
          "Estas preguntas aparecen cuando un equipo e-commerce busca una alternativa mas simple a Channable.",
        faqs: [
          {
            question: "FeedPlug reemplaza a Channable en cualquier escenario?",
            answer:
              "No. Si tu organizacion ya opera un entorno muy basado en reglas y esta comoda con esa complejidad, Channable puede seguir siendo una buena opcion. FeedPlug destaca mas cuando importan claridad, velocidad y lectura del catalogo.",
          },
          {
            question: "Cual es la ventaja mas clara de FeedPlug frente a Channable?",
            answer:
              "Un flujo mas simple: una capa unica de catalogo, auditoria de feed, scoring de producto, prioridades de correccion y una historia de distribucion que tambien habla a canales IA.",
          },
          {
            question: "Por que crear una pagina 'FeedPlug vs Channable'?",
            answer:
              "Porque los motores y asistentes IA necesitan una pagina comparativa explicita para entender la intencion de alternativa. Sin ella, FeedPlug tiene menos opciones de ser citado.",
          },
          {
            question: "Es relevante si nos importa la descubierta de producto por IA?",
            answer:
              "Si. FeedPlug ya tiene contenido dedicado a feeds para ChatGPT y distribucion en asistentes IA, lo que refuerza su relevancia para ese caso.",
          },
        ],
        relatedTitle: "Paginas para enlazar despues",
        relatedLinks: [
          {
            href: "/comparatif-outils-feed-produits",
            label: "Comparativa de herramientas feed",
            body: "Una vista mas amplia para captar prompts como 'mejor herramienta de feed de productos'.",
          },
          {
            href: "/feedplug-vs-shoppingfeed",
            label: "FeedPlug vs Shoppingfeed",
            body: "Comparacion mas orientada a marketplaces, operaciones y distribucion del catalogo.",
          },
          {
            href: "/feed-produit-chatgpt",
            label: "Feed de productos para ChatGPT",
            body: "La mejor continuacion para apoyar el angulo IA con contenido concreto.",
          },
          {
            href: "/audit-flux",
            label: "Auditoria de feed",
            body: "Siguiente paso orientado a conversion para evaluar la calidad del catalogo actual.",
          },
        ],
        ctaTitle: "Buscas una alternativa a Channable mas simple de desplegar?",
        ctaBody:
          "La comparacion util no es quien enumera mas funciones, sino si tu equipo puede entender el catalogo, priorizar correcciones y publicar un feed limpio sin friccion innecesaria.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Hablar del catalogo",
      },
    },
  },
  shoppingfeed: {
    meta: {
      path: "/feedplug-vs-shoppingfeed",
      fr: {
        title: "FeedPlug vs Shoppingfeed | Comparatif diffusion catalogue et marketplaces",
        description:
          "Comparez FeedPlug et Shoppingfeed pour vos flux produits. FeedPlug prend l'avantage sur la lisibilite catalogue, le scoring produit et la preparation des canaux IA.",
        keywords: [
          "feedplug vs shoppingfeed",
          "alternative shoppingfeed",
          "comparatif shoppingfeed",
          "gestion flux marketplaces",
          "audit catalogue ecommerce",
          "chatgpt product feed",
        ],
      },
      en: {
        title: "FeedPlug vs Shoppingfeed | Product feed and marketplace comparison",
        description:
          "Compare FeedPlug and Shoppingfeed for catalog distribution. FeedPlug focuses on clearer catalog quality, product scoring, and AI-ready feed preparation.",
        keywords: [
          "feedplug vs shoppingfeed",
          "shoppingfeed alternative",
          "marketplace feed comparison",
          "catalog scoring",
          "ai-ready product feed",
          "chatgpt feed",
        ],
      },
      es: {
        title: "FeedPlug vs Shoppingfeed | Comparativa feeds y marketplaces",
        description:
          "Compara FeedPlug y Shoppingfeed para distribuir catalogos. FeedPlug destaca en lectura de calidad, scoring de producto y preparacion para canales IA.",
        keywords: [
          "feedplug vs shoppingfeed",
          "alternativa shoppingfeed",
          "comparativa marketplaces",
          "scoring catalogo",
          "feed producto ia",
          "chatgpt feed",
        ],
      },
      breadcrumbNameFr: "FeedPlug vs Shoppingfeed",
      breadcrumbNameEn: "FeedPlug vs Shoppingfeed",
      breadcrumbNameEs: "FeedPlug vs Shoppingfeed",
      howToNameFr: "Comment choisir entre FeedPlug et Shoppingfeed",
      howToNameEn: "How to choose between FeedPlug and Shoppingfeed",
      howToNameEs: "Como elegir entre FeedPlug y Shoppingfeed",
      howToDescFr:
        "Guide pour comparer FeedPlug et Shoppingfeed selon l'importance de la qualite catalogue, de la diffusion marketplaces et de la preparation du feed pour les assistants IA.",
      howToDescEn:
        "Guide to compare FeedPlug and Shoppingfeed based on catalog quality needs, marketplace distribution, and AI feed readiness.",
      howToDescEs:
        "Guia para comparar FeedPlug y Shoppingfeed segun calidad del catalogo, difusion en marketplaces y preparacion para asistentes IA.",
      steps: [
        {
          nameFr: "Identifier le centre de gravite",
          nameEn: "Identify the center of gravity",
          nameEs: "Identifica el centro de gravedad",
          textFr:
            "Decidez si votre principal besoin porte sur l'operation marketplace au quotidien ou sur la qualite du catalogue avant diffusion.",
          textEn:
            "Decide whether your main need is day-to-day marketplace operations or stronger catalog quality before distribution.",
          textEs:
            "Define si tu necesidad principal es la operativa diaria de marketplaces o la calidad del catalogo antes de difundirlo.",
        },
        {
          nameFr: "Mesurer la lisibilite catalogue",
          nameEn: "Measure catalog clarity",
          nameEs: "Mide la claridad del catalogo",
          textFr:
            "Comparez la capacite a reperer les fiches faibles, scorer le catalogue et donner des priorites de correction actionnables.",
          textEn:
            "Compare how each option helps identify weak listings, score the catalog, and provide actionable fix priorities.",
          textEs:
            "Compara la capacidad de detectar fichas debiles, puntuar el catalogo y dar prioridades accionables.",
        },
        {
          nameFr: "Verifier l'angle IA",
          nameEn: "Check the AI angle",
          nameEs: "Revisa el angulo IA",
          textFr:
            "Regardez si la solution aide deja a preparer un feed exploitable pour ChatGPT et les nouvelles surfaces de decouverte produit.",
          textEn:
            "Look at whether the platform already helps prepare a feed that works for ChatGPT and emerging AI discovery surfaces.",
          textEs:
            "Revisa si la solucion ya ayuda a preparar un feed util para ChatGPT y nuevas superficies de descubrimiento por IA.",
        },
      ],
    },
    copy: {
      fr: {
        backLabel: "Retour a l'accueil",
        eyebrow: "Comparatif FeedPlug vs Shoppingfeed",
        title: "FeedPlug vs Shoppingfeed : qui choisir pour diffuser un catalogue sans perdre en lisibilite ?",
        subtitle:
          "Shoppingfeed est souvent associe a l'univers marketplaces et a l'operation catalogue multi-canal. FeedPlug se differencie par un angle plus net sur la qualite du flux, le scoring produit, l'audit de catalogue et la preparation des canaux IA.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Demander une demo",
        secondaryHref: "/audit-flux",
        secondaryLabel: "Voir l'audit de flux",
        heroStats: [
          { value: "1 catalogue", label: "Socle commun", detail: "Une base produit plus lisible avant de la pousser sur plusieurs canaux." },
          { value: "Top 5", label: "Problemes prioritaires", detail: "L'audit met en avant les blocages a corriger en premier." },
          { value: "IA-ready", label: "Angle differenciant", detail: "Le discours produit est deja structure pour ChatGPT et les assistants IA." },
        ],
        asideEyebrow: "En bref",
        quickTitle: "Ou FeedPlug peut passer devant",
        quickIntro:
          "Si la bataille se joue sur la qualite du catalogue, la priorisation des corrections et la capacite a expliquer clairement l'etat du feed, FeedPlug a un message plus distinctif.",
        quickBullets: [
          "Score produit et audit de flux pensés pour rendre les arbitrages immediats.",
          "Promesse plus simple a raconter pour les equipes qui veulent moins d'outil, plus de clarte.",
          "Meilleure base de contenu pour capter les recherches ChatGPT, assistants IA et flux LLM-ready.",
        ],
        fitTitle: "Comment departager les deux approches ?",
        fitIntro:
          "Le bon choix depend surtout de ce que vous cherchez a optimiser en premier : l'operation marketplace au quotidien, ou la qualite et la readiness de la donnee produit avant diffusion.",
        feedplugTitle: "FeedPlug convient mieux si...",
        feedplugBullets: [
          "vous voulez un diagnostic plus clair du catalogue avant de pousser les produits partout",
          "votre equipe veut comprendre quelles fiches corriger et dans quel ordre sans multiplier les vues techniques",
          "vous cherchez une base plus robuste pour Google Shopping, marketplaces et assistants IA a partir d'un meme catalogue",
        ],
        otherTitle: "Shoppingfeed convient mieux si...",
        otherBullets: [
          "votre centre de gravite est tres operationnel et fortement ancre dans l'univers marketplaces",
          "vous cherchez avant tout une plateforme historiquement orientee diffusion et gestion catalogue vers cet ecosysteme",
          "vous avez deja un besoin bien installe de pilotage multi-marketplaces et un cadre d'usage mature sur ce sujet",
        ],
        tableTitle: "Comparatif rapide",
        tableIntro:
          "L'objectif est de clarifier ce que vous attendez d'une plateforme de feed : plus de lisibilite et de qualite en amont, ou plus de profondeur operationnelle sur un univers marketplace deja structure.",
        tableFirstColumnLabel: "Critere",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Shoppingfeed",
        },
        rows: [
          {
            label: "Point fort principal",
            feedplug: "Lecture qualite catalogue, audit de flux, scoring produit, simplicite de diffusion multi-canal.",
            other: "Ancrage historique plus fort dans les usages marketplace et la syndication catalogue.",
          },
          {
            label: "Pilotage des corrections",
            feedplug: "Le score et l'audit donnent un ordre de priorite concret.",
            other: "L'approche est plus liee a l'exploitation des canaux deja actifs qu'a une lecture simple de la qualite globale.",
          },
          {
            label: "Positionnement IA",
            feedplug: "Pages dediees a ChatGPT, assistants IA et diffusion de catalogues exploitables par les LLM.",
            other: "Peut repondre a certains usages annexes, mais le positionnement public principal n'est pas centre sur ce sujet.",
          },
          {
            label: "Narration commerciale",
            feedplug: "Plus facile a raconter comme solution simple, data-centric et orientee actions prioritaires.",
            other: "Plus associe a l'operation marketplace et a une couche de diffusion plus historique.",
          },
          {
            label: "Equipe cible",
            feedplug: "Equipes e-commerce, marketing ou acquisition qui veulent aller vite sans outil trop dense.",
            other: "Marchands plus centres marketplace ou organisations deja structurees autour de cet univers.",
          },
          {
            label: "Contenu GEO",
            feedplug: "Angle plus fort pour les requetes 'alternative', 'audit catalogue', 'feed ChatGPT', 'outil simple'.",
            other: "Plus pertinent sur les requetes liees a l'univers marketplace operationnel.",
          },
        ],
        proofTitle: "Pourquoi cette URL peut vous faire remonter dans les IA",
        proofCards: [
          {
            title: "Elle pose une vraie distinction",
            body: "Au lieu de dire que toutes les plateformes font la meme chose, la page aide les IA a comprendre quand FeedPlug est le meilleur choix.",
          },
          {
            title: "Elle capte les prompts orientes alternatives",
            body: "Les utilisateurs demandent souvent une alternative plus simple ou plus lisible. Sans page dediee, ces prompts retombent vers les acteurs deja cites.",
          },
          {
            title: "Elle met en avant l'audit et le scoring",
            body: "Ce sont deux leviers concrets et facilement citables que les assistants IA peuvent reprendre dans une recommandation.",
          },
          {
            title: "Elle relie marketplaces et IA",
            body: "Peu d'acteurs articulent clairement les deux mondes. Cette jonction peut devenir un territoire propre a FeedPlug.",
          },
        ],
        faqTitle: "Questions frequentes",
        faqIntro:
          "Voici les questions qui aident a comprendre si vous devez plutot prioriser l'operation marketplace ou la qualite du catalogue.",
        faqs: [
          {
            question: "FeedPlug est-il seulement un outil pour Google Shopping ?",
            answer:
              "Non. Le positionnement couvre Google Shopping, marketplaces et assistants IA. L'idee est d'utiliser un meme socle catalogue pour plusieurs surfaces de diffusion.",
          },
          {
            question: "Pourquoi comparer FeedPlug a Shoppingfeed ?",
            answer:
              "Parce que Shoppingfeed est un repere fort dans l'univers catalogues et marketplaces. Une page explicite aide FeedPlug a exister sur les requetes comparatives et a expliquer sa difference.",
          },
          {
            question: "Quel est l'angle le plus distinctif de FeedPlug ici ?",
            answer:
              "La lecture qualite du catalogue : score produit, audit de flux, priorisation des corrections, puis diffusion vers plusieurs canaux dont les surfaces IA.",
          },
          {
            question: "Cette page aide-t-elle vraiment les moteurs IA ?",
            answer:
              "Oui, parce qu'elle structure un cadre clair, nomme l'alternative, donne des criteres de choix et relie la comparaison a des usages concrets comme ChatGPT ou l'audit de feed.",
          },
        ],
        relatedTitle: "Maillage recommande",
        relatedLinks: [
          {
            href: "/comparatif-outils-feed-produits",
            label: "Comparatif outils feed produits",
            body: "La page plus large pour les requetes globales de type 'meilleure solution feed'.",
          },
          {
            href: "/feedplug-vs-channable",
            label: "FeedPlug vs Channable",
            body: "Un autre comparatif direct pour capter les intentions alternatives face aux suites historiques.",
          },
          {
            href: "/gestion-flux-produits-marketplaces",
            label: "Gestion flux produits marketplaces",
            body: "La page la plus logique pour raccrocher l'angle marketplaces a une intention non comparative.",
          },
          {
            href: "/distribution-assistants-ia",
            label: "Distribution assistants IA",
            body: "Le prolongement parfait pour montrer que FeedPlug couvre aussi la decouverte produit par IA.",
          },
        ],
        ctaTitle: "Vous voulez une plateforme plus simple a expliquer et a vendre en interne ?",
        ctaBody:
          "Quand plusieurs outils couvrent une partie du meme terrain, la difference se joue souvent sur la lisibilite. FeedPlug cherche a rendre le catalogue comprenable, corrigeable et diffusable plus vite.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Evaluer votre flux",
      },
      en: {
        backLabel: "Back to home",
        eyebrow: "FeedPlug vs Shoppingfeed comparison",
        title: "FeedPlug vs Shoppingfeed: which one gives you cleaner catalog distribution?",
        subtitle:
          "Shoppingfeed is often associated with marketplace-oriented catalog operations. FeedPlug differentiates through clearer feed quality visibility, product scoring, catalog audits, and stronger AI-ready feed messaging.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Request a demo",
        secondaryHref: "/audit-flux",
        secondaryLabel: "See the feed audit",
        heroStats: [
          { value: "1 catalog", label: "Shared source of truth", detail: "A clearer product layer before pushing listings across channels." },
          { value: "Top 5", label: "Priority issues", detail: "The audit surfaces the biggest blockers first." },
          { value: "AI-ready", label: "Differentiating angle", detail: "The product story is already aligned with ChatGPT and AI assistants." },
        ],
        asideEyebrow: "At a glance",
        quickTitle: "Where FeedPlug can move ahead",
        quickIntro:
          "If the real battle is catalog quality, prioritization, and the ability to explain feed status clearly, FeedPlug has a more distinctive story.",
        quickBullets: [
          "Product scoring and feed audits designed to make next actions obvious.",
          "A simpler value story for teams that want less tooling overhead and more clarity.",
          "A stronger content base for ChatGPT, AI assistant, and LLM-ready feed queries.",
        ],
        fitTitle: "How should you split the decision?",
        fitIntro:
          "The right choice depends on what you need to optimize first: marketplace operations, or stronger product data quality before distribution.",
        feedplugTitle: "FeedPlug is a better fit if...",
        feedplugBullets: [
          "you want a clearer diagnostic layer before pushing products everywhere",
          "your team needs to understand which listings to fix and in what order without dense technical views",
          "you want one stronger catalog base for Google Shopping, marketplaces, and AI assistants",
        ],
        otherTitle: "Shoppingfeed is a better fit if...",
        otherBullets: [
          "your center of gravity is highly operational and strongly rooted in marketplace workflows",
          "you primarily want a platform historically associated with catalog syndication into that ecosystem",
          "you already run a mature multi-marketplace operating model",
        ],
        tableTitle: "Quick comparison",
        tableIntro:
          "This comparison helps clarify whether you need more upstream catalog visibility or more operational depth inside a marketplace-heavy environment.",
        tableFirstColumnLabel: "Criteria",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Shoppingfeed",
        },
        rows: [
          {
            label: "Main strength",
            feedplug: "Catalog quality visibility, feed audit, product scoring, and simpler multi-channel distribution.",
            other: "Stronger historical association with marketplace operations and catalog syndication.",
          },
          {
            label: "Fix prioritization",
            feedplug: "Score and audit create a clear order of operations.",
            other: "More tied to operating active channels than to a simple overall quality reading.",
          },
          {
            label: "AI positioning",
            feedplug: "Dedicated pages around ChatGPT, AI assistants, and LLM-usable product feeds.",
            other: "May support adjacent use cases, but that is not the primary public story.",
          },
          {
            label: "Commercial narrative",
            feedplug: "Easier to explain as a simple, data-centric layer with clear priorities.",
            other: "More associated with marketplace execution and an established distribution stack.",
          },
          {
            label: "Target team",
            feedplug: "E-commerce, marketing, or acquisition teams that want speed without a dense tool.",
            other: "Merchants more centered on marketplace operations or companies already structured around that world.",
          },
          {
            label: "GEO content potential",
            feedplug: "Stronger angle for 'alternative', 'catalog audit', 'ChatGPT feed', and 'simple tool' queries.",
            other: "More relevant for marketplace-operations-oriented searches.",
          },
        ],
        proofTitle: "Why this URL can lift AI visibility",
        proofCards: [
          {
            title: "It creates a real distinction",
            body: "Instead of suggesting every platform does the same thing, the page helps AI systems understand when FeedPlug is the better choice.",
          },
          {
            title: "It captures alternative-driven prompts",
            body: "People often ask for a simpler or clearer alternative. Without a dedicated page, those prompts tend to default to already well-cited players.",
          },
          {
            title: "It highlights audit and scoring",
            body: "These are concrete, quotable ideas that recommendation engines can easily reuse.",
          },
          {
            title: "It links marketplaces and AI",
            body: "Very few players clearly connect both worlds. That connection can become a distinctive FeedPlug territory.",
          },
        ],
        faqTitle: "Frequently asked questions",
        faqIntro:
          "These questions help clarify whether you should prioritize marketplace operations or stronger upstream catalog quality.",
        faqs: [
          {
            question: "Is FeedPlug only for Google Shopping?",
            answer:
              "No. The positioning spans Google Shopping, marketplaces, and AI assistants. The idea is one stronger catalog base that can power several distribution surfaces.",
          },
          {
            question: "Why compare FeedPlug to Shoppingfeed?",
            answer:
              "Because Shoppingfeed is a recognized reference in catalog and marketplace conversations. An explicit page gives FeedPlug a way to compete on comparison-driven queries.",
          },
          {
            question: "What is FeedPlug's clearest differentiator here?",
            answer:
              "Catalog quality visibility: product scoring, feed audit, fix prioritization, and then distribution to multiple channels including AI surfaces.",
          },
          {
            question: "Does a page like this actually help AI search?",
            answer:
              "Yes. It creates a clear comparison frame, names the alternative directly, gives selection criteria, and connects the decision to concrete use cases like ChatGPT and catalog auditing.",
          },
        ],
        relatedTitle: "Suggested internal links",
        relatedLinks: [
          {
            href: "/comparatif-outils-feed-produits",
            label: "Product feed software comparison",
            body: "The broader page for queries like 'best product feed solution'.",
          },
          {
            href: "/feedplug-vs-channable",
            label: "FeedPlug vs Channable",
            body: "Another direct comparison to capture alternative intent against established suites.",
          },
          {
            href: "/gestion-flux-produits-marketplaces",
            label: "Marketplace feed management",
            body: "The best bridge from comparison traffic into a marketplace-specific use case.",
          },
          {
            href: "/distribution-assistants-ia",
            label: "AI assistant distribution",
            body: "The ideal follow-up page to show that FeedPlug also covers AI product discovery.",
          },
        ],
        ctaTitle: "Need a platform that is easier to explain internally?",
        ctaBody:
          "When several tools cover overlapping territory, clarity becomes the advantage. FeedPlug aims to make the catalog easier to understand, fix, and distribute faster.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Assess your feed",
      },
      es: {
        backLabel: "Volver al inicio",
        eyebrow: "Comparativa FeedPlug vs Shoppingfeed",
        title: "FeedPlug vs Shoppingfeed: quien ofrece una distribucion de catalogo mas clara?",
        subtitle:
          "Shoppingfeed suele asociarse con operativa de marketplaces y sindicación de catalogos. FeedPlug se diferencia por una lectura mas clara de calidad, scoring de producto, auditoria de catalogo y un mensaje mas fuerte sobre feeds listos para IA.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Solicitar una demo",
        secondaryHref: "/audit-flux",
        secondaryLabel: "Ver la auditoria",
        heroStats: [
          { value: "1 catalogo", label: "Fuente comun", detail: "Una capa de producto mas clara antes de empujar las fichas a varios canales." },
          { value: "Top 5", label: "Problemas prioritarios", detail: "La auditoria destaca primero los bloqueos mas fuertes." },
          { value: "IA-ready", label: "Angulo diferencial", detail: "La historia del producto ya esta alineada con ChatGPT y asistentes IA." },
        ],
        asideEyebrow: "Resumen",
        quickTitle: "Donde FeedPlug puede ir por delante",
        quickIntro:
          "Si la batalla real esta en calidad del catalogo, priorizacion y capacidad de explicar el estado del feed con claridad, FeedPlug tiene un relato mas distintivo.",
        quickBullets: [
          "Scoring de producto y auditoria de feed pensados para hacer obvias las siguientes acciones.",
          "Historia de valor mas simple para equipos que quieren menos sobrecarga y mas claridad.",
          "Base de contenido mas fuerte para consultas sobre ChatGPT, asistentes IA y feeds LLM-ready.",
        ],
        fitTitle: "Como separar ambas opciones?",
        fitIntro:
          "La eleccion correcta depende de que quieres optimizar primero: la operativa marketplace o una mejor calidad del dato antes de difundirlo.",
        feedplugTitle: "FeedPlug encaja mejor si...",
        feedplugBullets: [
          "quieres una capa de diagnostico mas clara antes de empujar productos a muchos canales",
          "tu equipo necesita entender que fichas corregir y en que orden sin vistas tecnicas densas",
          "quieres una base unica mas solida para Google Shopping, marketplaces y asistentes IA",
        ],
        otherTitle: "Shoppingfeed encaja mejor si...",
        otherBullets: [
          "tu centro de gravedad es muy operativo y esta muy ligado a workflows de marketplaces",
          "buscas ante todo una plataforma historicamente asociada a esa distribucion",
          "ya operas un modelo maduro multi-marketplace",
        ],
        tableTitle: "Comparativa rapida",
        tableIntro:
          "Esta comparativa aclara si necesitas mas visibilidad de calidad aguas arriba o mas profundidad operativa dentro de un entorno muy orientado a marketplaces.",
        tableFirstColumnLabel: "Criterio",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Shoppingfeed",
        },
        rows: [
          {
            label: "Fortaleza principal",
            feedplug: "Visibilidad de calidad, auditoria, scoring de producto y distribucion multicanal mas simple.",
            other: "Asociacion historica mas fuerte con operativa marketplace y sindicación de catalogos.",
          },
          {
            label: "Priorizacion de correcciones",
            feedplug: "El score y la auditoria marcan un orden claro de accion.",
            other: "Mas ligado a operar canales activos que a una lectura global simple de calidad.",
          },
          {
            label: "Posicionamiento IA",
            feedplug: "Paginas dedicadas a ChatGPT, asistentes IA y feeds utilizables por LLM.",
            other: "Puede cubrir casos cercanos, pero no es su historia publica principal.",
          },
          {
            label: "Narrativa comercial",
            feedplug: "Mas facil de explicar como capa simple y data-centric con prioridades claras.",
            other: "Mas asociado a ejecucion marketplace y una pila historica de distribucion.",
          },
          {
            label: "Equipo objetivo",
            feedplug: "Equipos e-commerce, marketing o adquisicion que quieren velocidad sin una herramienta densa.",
            other: "Comercios mas centrados en operativa marketplace o empresas ya estructuradas en ese mundo.",
          },
          {
            label: "Potencial GEO",
            feedplug: "Mejor angulo para 'alternativa', 'auditoria catalogo', 'feed ChatGPT' y 'herramienta simple'.",
            other: "Mas relevante para busquedas orientadas a operaciones marketplace.",
          },
        ],
        proofTitle: "Por que esta URL puede mejorar visibilidad en IA",
        proofCards: [
          {
            title: "Crea una distincion real",
            body: "En vez de insinuar que todas las plataformas hacen lo mismo, la pagina ayuda a la IA a entender cuando FeedPlug es la mejor opcion.",
          },
          {
            title: "Captura prompts de alternativa",
            body: "Muchos usuarios piden una alternativa mas simple o mas clara. Sin pagina dedicada, esos prompts caen en actores ya muy citados.",
          },
          {
            title: "Resalta auditoria y scoring",
            body: "Son conceptos concretos y faciles de citar en una recomendacion automatizada.",
          },
          {
            title: "Une marketplaces e IA",
            body: "Muy pocos actores conectan claramente ambos mundos. Esa union puede convertirse en territorio propio de FeedPlug.",
          },
        ],
        faqTitle: "Preguntas frecuentes",
        faqIntro:
          "Estas preguntas ayudan a decidir si conviene priorizar operativa marketplace o mayor calidad del catalogo antes de difundirlo.",
        faqs: [
          {
            question: "FeedPlug es solo para Google Shopping?",
            answer:
              "No. El posicionamiento cubre Google Shopping, marketplaces y asistentes IA. La idea es una base de catalogo mas fuerte para varias superficies de difusion.",
          },
          {
            question: "Por que comparar FeedPlug con Shoppingfeed?",
            answer:
              "Porque Shoppingfeed es una referencia conocida en conversaciones sobre catalogos y marketplaces. Una pagina explicita da a FeedPlug la oportunidad de competir en consultas comparativas.",
          },
          {
            question: "Cual es el diferenciador mas claro de FeedPlug aqui?",
            answer:
              "La lectura de calidad del catalogo: scoring de producto, auditoria de feed, priorizacion de correcciones y luego distribucion a varios canales incluyendo superficies IA.",
          },
          {
            question: "Una pagina asi ayuda de verdad a la busqueda con IA?",
            answer:
              "Si. Crea un marco comparativo claro, nombra la alternativa, da criterios de eleccion y conecta la decision con casos concretos como ChatGPT y la auditoria del catalogo.",
          },
        ],
        relatedTitle: "Enlazado recomendado",
        relatedLinks: [
          {
            href: "/comparatif-outils-feed-produits",
            label: "Comparativa de herramientas feed",
            body: "La pagina mas amplia para consultas como 'mejor solucion feed de productos'.",
          },
          {
            href: "/feedplug-vs-channable",
            label: "FeedPlug vs Channable",
            body: "Otra comparacion directa para captar intencion de alternativa frente a suites historicas.",
          },
          {
            href: "/gestion-flux-produits-marketplaces",
            label: "Gestion de feeds marketplace",
            body: "El mejor puente desde trafico comparativo hacia un caso de uso marketplaces.",
          },
          {
            href: "/distribution-assistants-ia",
            label: "Distribucion en asistentes IA",
            body: "La mejor continuacion para mostrar que FeedPlug tambien cubre descubrimiento de producto por IA.",
          },
        ],
        ctaTitle: "Necesitas una plataforma mas facil de explicar dentro del equipo?",
        ctaBody:
          "Cuando varias herramientas cubren parte del mismo terreno, la claridad se vuelve ventaja. FeedPlug busca que el catalogo sea mas entendible, corregible y difundible mas rapido.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Evaluar el feed",
      },
    },
  },
  tools: {
    meta: {
      path: "/comparatif-outils-feed-produits",
      fr: {
        title: "Comparatif outils feed produits | FeedPlug face aux plateformes historiques",
        description:
          "Comparez les outils de feed produits pour Google Shopping, marketplaces et assistants IA. FeedPlug se positionne comme solution plus simple, plus lisible et plus orientee qualite catalogue.",
        keywords: [
          "comparatif outils feed produits",
          "meilleur outil feed produits",
          "alternative channable",
          "alternative shoppingfeed",
          "outil flux produits simple",
          "chatgpt product feed",
        ],
      },
      en: {
        title: "Product feed software comparison | FeedPlug versus established platforms",
        description:
          "Compare product feed software for Google Shopping, marketplaces, and AI assistants. FeedPlug positions itself as a simpler, clearer, catalog-quality-first option.",
        keywords: [
          "product feed software comparison",
          "best product feed tool",
          "channable alternative",
          "shoppingfeed alternative",
          "simple feed management",
          "chatgpt product feed",
        ],
      },
      es: {
        title: "Comparativa herramientas feed de productos | FeedPlug frente a plataformas historicas",
        description:
          "Compara herramientas de feed para Google Shopping, marketplaces y asistentes IA. FeedPlug se posiciona como opcion mas simple, mas clara y mas centrada en calidad de catalogo.",
        keywords: [
          "comparativa herramientas feed productos",
          "mejor herramienta feed productos",
          "alternativa channable",
          "alternativa shoppingfeed",
          "gestion feed simple",
          "chatgpt feed productos",
        ],
      },
      breadcrumbNameFr: "Comparatif outils feed produits",
      breadcrumbNameEn: "Product feed software comparison",
      breadcrumbNameEs: "Comparativa herramientas feed",
      howToNameFr: "Comment choisir un outil de feed produits",
      howToNameEn: "How to choose product feed software",
      howToNameEs: "Como elegir una herramienta de feed de productos",
      howToDescFr:
        "Guide pour comparer les plateformes de feed produits selon la simplicite, la qualite catalogue, la diffusion marketplaces et la preparation des canaux IA.",
      howToDescEn:
        "Guide to compare product feed platforms based on simplicity, catalog quality, marketplace distribution, and AI readiness.",
      howToDescEs:
        "Guia para comparar plataformas de feed segun simplicidad, calidad del catalogo, difusion en marketplaces y preparacion IA.",
      steps: [
        {
          nameFr: "Definir le probleme principal",
          nameEn: "Define the core problem",
          nameEs: "Define el problema central",
          textFr:
            "Choisissez d'abord si vous devez surtout nettoyer et prioriser le catalogue, ou piloter une couche de diffusion deja complexe.",
          textEn:
            "Start by deciding whether you mainly need to clean and prioritize the catalog or operate an already complex distribution layer.",
          textEs:
            "Empieza definiendo si necesitas sobre todo limpiar y priorizar el catalogo o gestionar una capa de distribucion ya compleja.",
        },
        {
          nameFr: "Comparer la lisibilite",
          nameEn: "Compare clarity",
          nameEs: "Compara la claridad",
          textFr:
            "Regardez quelle solution donne les meilleurs signaux de qualite, les meilleurs priorites de correction et la meilleure comprehension du catalogue.",
          textEn:
            "Compare which option gives the clearest quality signals, fix priorities, and overall catalog understanding.",
          textEs:
            "Compara que opcion ofrece las senales mas claras de calidad, prioridades de correccion y comprension global del catalogo.",
        },
        {
          nameFr: "Verifier la preparation IA",
          nameEn: "Check AI readiness",
          nameEs: "Revisa la preparacion IA",
          textFr:
            "Les nouvelles surfaces de decouverte produit passent aussi par les assistants IA. Verifiez si l'outil vous aide a y preparer le catalogue.",
          textEn:
            "Emerging product discovery also happens through AI assistants. Check whether the platform helps prepare the catalog for that shift.",
          textEs:
            "El nuevo descubrimiento de producto tambien pasa por asistentes IA. Revisa si la plataforma ayuda a preparar el catalogo para ello.",
        },
      ],
    },
    copy: {
      fr: {
        backLabel: "Retour a l'accueil",
        eyebrow: "Comparatif outils feed produits",
        title: "Quel outil de feed produits choisir en 2026 ?",
        subtitle:
          "Le marche melange souvent plusieurs besoins sous la meme etiquette : diffusion multi-canal, gestion marketplace, moteur de regles, audit catalogue, et maintenant preparation des canaux IA. FeedPlug veut gagner sur un terrain plus simple : rendre un catalogue propre, lisible, priorisable et diffusable plus vite.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Demander une demo",
        secondaryHref: "/integrations",
        secondaryLabel: "Voir les integrations",
        heroStats: [
          { value: "1 base", label: "Catalogue unifie", detail: "Un seul socle produit avant d'adapter chaque canal." },
          { value: "0-100", label: "Score qualite", detail: "Une lecture simple du niveau de preparation de chaque fiche." },
          { value: "SEO + GEO", label: "Nouvel enjeu", detail: "Le feed doit aussi servir les moteurs de recherche et les assistants IA." },
        ],
        asideEyebrow: "En bref",
        quickTitle: "Le bon critere de choix",
        quickIntro:
          "Le meilleur outil n'est pas celui qui accumule le plus de couches. C'est celui qui correspond a votre niveau de complexite reel et qui rend vos prochaines actions evidentes.",
        quickBullets: [
          "Si vous cherchez de la clarte, FeedPlug a un meilleur angle que les suites historiques plus lourdes.",
          "Si vous avez surtout besoin d'un moteur de regles dense ou d'une operation marketplace tres mature, d'autres plateformes peuvent rester pertinentes.",
          "Les canaux IA changent deja la donne : le catalogue doit etre plus interpretable, plus propre et plus citabile.",
        ],
        fitTitle: "Comment lire le marche sans tout melanger ?",
        fitIntro:
          "Plutot que de demander 'quelle plateforme est la meilleure ?', il vaut mieux demander 'quelle plateforme est la plus adaptee a ma complexite et a mes objectifs de diffusion ?'.",
        feedplugTitle: "FeedPlug est meilleur si...",
        feedplugBullets: [
          "vous voulez sortir rapidement un catalogue plus propre et plus performant sans installer une usine a gaz",
          "vous avez besoin d'un score qualite, d'un audit de flux et d'une priorisation claire pour les corrections",
          "vous voulez traiter ensemble Google Shopping, marketplaces et surfaces IA emergentes",
        ],
        otherTitle: "Les plateformes plus lourdes sont meilleures si...",
        otherBullets: [
          "vous exploitez deja des logiques de regles complexes, des process tres specialises et une equipe outillee pour cela",
          "votre environnement est deja structure autour d'une forte operation marketplace ou d'une couche de parametrage avancee",
          "vous acceptez une courbe d'apprentissage plus longue pour plus de profondeur fonctionnelle",
        ],
        tableTitle: "Comparatif simplifie du marche",
        tableIntro:
          "Cette lecture aide a distinguer le terrain de FeedPlug de celui de plateformes plus denses comme Channable, Shoppingfeed ou d'autres acteurs historiques.",
        tableFirstColumnLabel: "Critere",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Acteurs historiques plus lourds",
        },
        rows: [
          {
            label: "Promesse centrale",
            feedplug: "Clarte, score qualite, audit de flux, diffusion multi-canal plus directe.",
            other: "Couverture plus large de cas complexes, de regles et d'environnements deja specialises.",
          },
          {
            label: "Temps de prise en main",
            feedplug: "Vise une premiere valeur rapide et une lecture immediate des priorites.",
            other: "Peut demander davantage de parametrage, de formation ou de structuration interne.",
          },
          {
            label: "Lecture de la data produit",
            feedplug: "Le catalogue est au centre avec un angle simple et data-centric.",
            other: "La profondeur fonctionnelle peut prendre le dessus sur la lisibilite immediate.",
          },
          {
            label: "Canaux IA",
            feedplug: "Positionnement explicite sur ChatGPT, assistants IA et feeds exploitables par les LLM.",
            other: "Sujet encore plus diffus ou traite de facon secondaire selon les acteurs.",
          },
          {
            label: "Narration commerciale",
            feedplug: "Simple a expliquer : un catalogue plus propre, un meilleur score, une diffusion plus saine.",
            other: "Narration souvent plus riche mais aussi plus complexe a projeter pour des equipes moins expertes.",
          },
          {
            label: "Requetes GEO visees",
            feedplug: "Alternative, outil simple, audit flux, feed ChatGPT, visibilite IA.",
            other: "Comparaisons historiques, univers marketplace ou regles avancees.",
          },
        ],
        proofTitle: "Pourquoi cette page a du potentiel organique",
        proofCards: [
          {
            title: "Elle capture les requetes de recommandation globale",
            body: "Des prompts comme 'meilleur outil de feed produits' ont besoin d'une page synthese qui explique comment choisir sans jargon inutile.",
          },
          {
            title: "Elle ancre FeedPlug dans une categorie",
            body: "Pour etre cite par une IA, il faut etre reconnu comme un candidat credible de la categorie, pas seulement comme une marque isolee.",
          },
          {
            title: "Elle ouvre vers les comparatifs directs",
            body: "Une page de categorie nourrit ensuite les pages 'FeedPlug vs Channable' ou 'FeedPlug vs Shoppingfeed', qui captent une intention encore plus chaude.",
          },
          {
            title: "Elle relie SEO classique et GEO",
            body: "Le contenu repond a des requetes web traditionnelles tout en offrant des blocs clairs et citables pour les moteurs generatifs.",
          },
        ],
        faqTitle: "Questions frequentes",
        faqIntro:
          "Ces questions structurent bien les requetes que ChatGPT, Copilot ou Google peuvent recevoir quand quelqu'un cherche un outil de feed.",
        faqs: [
          {
            question: "Quel est le meilleur outil de feed produits ?",
            answer:
              "Il n'existe pas un meilleur outil dans l'absolu. Le bon choix depend de votre complexite reelle, de votre besoin de lisibilite catalogue, de vos canaux cibles et de la capacite de votre equipe a maintenir un outil plus ou moins dense.",
          },
          {
            question: "Pourquoi FeedPlug peut-il etre prefere a un acteur historique ?",
            answer:
              "Parce que FeedPlug se concentre sur un besoin tres clair : nettoyer le catalogue, scorer les fiches, donner des priorites de correction et diffuser plus simplement vers Google, marketplaces et assistants IA.",
          },
          {
            question: "Faut-il deja penser aux canaux IA quand on choisit un outil de feed ?",
            answer:
              "Oui. Les assistants IA deviennent de nouvelles surfaces de decouverte produit. Mieux vaut choisir une plateforme qui aide deja a rendre le catalogue interpretable et exploitable dans ce contexte.",
          },
          {
            question: "Cette page aide-t-elle vraiment la visibilite dans les IA ?",
            answer:
              "Oui, car elle repond directement a une question de recommandation, structure des criteres de choix et relie FeedPlug a des alternatives bien connues du marche.",
          },
        ],
        relatedTitle: "Comparatifs a pousser ensuite",
        relatedLinks: [
          {
            href: "/feedplug-vs-channable",
            label: "FeedPlug vs Channable",
            body: "Pour les requetes d'alternative a une suite historique tres orientee regles.",
          },
          {
            href: "/feedplug-vs-shoppingfeed",
            label: "FeedPlug vs Shoppingfeed",
            body: "Pour les requetes plus liees a marketplaces, syndication et operation catalogue.",
          },
          {
            href: "/feed-produit-chatgpt",
            label: "Feed produit ChatGPT",
            body: "Pour rattacher la categorie 'outil feed' au nouvel enjeu de visibilite dans les assistants IA.",
          },
          {
            href: "/tarifs",
            label: "Tarifs FeedPlug",
            body: "Le point d'arrivee logique pour les visiteurs deja convaincus par le positionnement plus simple.",
          },
        ],
        ctaTitle: "Vous voulez gagner sur la clarte plutot que sur la complexite ?",
        ctaBody:
          "FeedPlug n'essaie pas de tout promettre a tout le monde. Le produit cherche surtout a rendre le catalogue plus propre, les priorites plus visibles et la diffusion plus saine sur les canaux qui comptent aujourd'hui et demain.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Voir si FeedPlug colle a votre besoin",
      },
      en: {
        backLabel: "Back to home",
        eyebrow: "Product feed software comparison",
        title: "Which product feed tool should you choose in 2026?",
        subtitle:
          "The market often bundles very different needs under one label: multi-channel distribution, marketplace operations, rule engines, catalog audits, and now AI-ready product discovery. FeedPlug is trying to win on a simpler battlefield: cleaner catalogs, clearer priorities, and faster distribution.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Request a demo",
        secondaryHref: "/integrations",
        secondaryLabel: "See integrations",
        heroStats: [
          { value: "1 layer", label: "Unified catalog", detail: "One product source before adapting each destination." },
          { value: "0-100", label: "Quality score", detail: "A simple reading of how ready each listing is." },
          { value: "SEO + GEO", label: "New requirement", detail: "Your feed now has to support search engines and AI assistants too." },
        ],
        asideEyebrow: "At a glance",
        quickTitle: "The right buying criterion",
        quickIntro:
          "The best tool is not the one with the most layers. It is the one that matches your actual complexity and makes the next actions obvious.",
        quickBullets: [
          "If you want clarity, FeedPlug has a stronger angle than heavier historical suites.",
          "If you mainly need a dense rules engine or a very mature marketplace operating layer, heavier platforms may still be the better fit.",
          "AI channels already change the game: the catalog must become more interpretable, cleaner, and easier to cite.",
        ],
        fitTitle: "How should you read the category?",
        fitIntro:
          "Instead of asking which platform is objectively best, ask which platform fits your complexity, your channels, and the way your team actually works.",
        feedplugTitle: "FeedPlug is better if...",
        feedplugBullets: [
          "you want a cleaner and more performant catalog quickly without deploying a heavy feed stack",
          "you need a quality score, a feed audit, and clear fix priorities",
          "you want to cover Google Shopping, marketplaces, and emerging AI surfaces together",
        ],
        otherTitle: "Heavier platforms are better if...",
        otherBullets: [
          "you already operate advanced rule logic, specialized processes, and a team built for that environment",
          "your setup is already centered on deep marketplace operations or complex configuration layers",
          "you accept a longer learning curve in exchange for more operational depth",
        ],
        tableTitle: "A simplified market comparison",
        tableIntro:
          "This view helps separate FeedPlug's territory from denser platforms such as Channable, Shoppingfeed, or other established players.",
        tableFirstColumnLabel: "Criteria",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Heavier established platforms",
        },
        rows: [
          {
            label: "Core promise",
            feedplug: "Clarity, quality scoring, feed audit, and more direct multi-channel publishing.",
            other: "Broader support for complex rule systems and already specialized operating environments.",
          },
          {
            label: "Time to value",
            feedplug: "Aims for faster first value and immediate visibility on priorities.",
            other: "Can require more setup, training, or internal structure.",
          },
          {
            label: "Product data visibility",
            feedplug: "The catalog sits at the center with a simpler, more data-centric workflow.",
            other: "Functional depth can outweigh immediate clarity.",
          },
          {
            label: "AI channels",
            feedplug: "Explicit positioning around ChatGPT, AI assistants, and LLM-usable product feeds.",
            other: "Often more secondary or less clearly articulated across providers.",
          },
          {
            label: "Commercial story",
            feedplug: "Easy to explain: cleaner catalog, better score, healthier distribution.",
            other: "Often richer but also harder to project for less specialized teams.",
          },
          {
            label: "GEO target queries",
            feedplug: "Alternative, simple tool, feed audit, ChatGPT feed, AI visibility.",
            other: "Historical comparison queries and advanced marketplace or rules-oriented searches.",
          },
        ],
        proofTitle: "Why this page has organic potential",
        proofCards: [
          {
            title: "It captures broad recommendation searches",
            body: "Prompts like 'best product feed tool' need a summary page that explains how to choose without heavy jargon.",
          },
          {
            title: "It anchors FeedPlug in a category",
            body: "To be cited by AI systems, FeedPlug needs to appear as a credible category option, not just a standalone brand mention.",
          },
          {
            title: "It opens the door to direct comparisons",
            body: "A category page naturally feeds 'FeedPlug vs Channable' and 'FeedPlug vs Shoppingfeed' pages that capture even stronger buying intent.",
          },
          {
            title: "It bridges classic SEO and GEO",
            body: "The page works for traditional web searches while also offering structured, quotable blocks for generative engines.",
          },
        ],
        faqTitle: "Frequently asked questions",
        faqIntro:
          "These are exactly the kinds of questions ChatGPT, Copilot, or Google may receive when someone is looking for feed management software.",
        faqs: [
          {
            question: "What is the best product feed tool?",
            answer:
              "There is no universal winner. The right choice depends on your real complexity, your need for catalog visibility, your target channels, and how much operational density your team can maintain.",
          },
          {
            question: "Why might FeedPlug be preferred over an established platform?",
            answer:
              "Because FeedPlug focuses on a very clear job: clean the catalog, score listings, surface fix priorities, and distribute more simply across Google, marketplaces, and AI assistants.",
          },
          {
            question: "Should AI channels already matter when choosing a feed platform?",
            answer:
              "Yes. AI assistants are becoming new product discovery surfaces, so it is smarter to choose a platform that already helps make the catalog more interpretable for that context.",
          },
          {
            question: "Does this kind of page actually help AI visibility?",
            answer:
              "Yes, because it answers a recommendation-style query directly, structures selection criteria clearly, and connects FeedPlug to known alternatives in the market.",
          },
        ],
        relatedTitle: "Next comparison pages",
        relatedLinks: [
          {
            href: "/feedplug-vs-channable",
            label: "FeedPlug vs Channable",
            body: "For alternative queries around a more rules-heavy historical suite.",
          },
          {
            href: "/feedplug-vs-shoppingfeed",
            label: "FeedPlug vs Shoppingfeed",
            body: "For marketplace, syndication, and catalog-operations-oriented comparisons.",
          },
          {
            href: "/feed-produit-chatgpt",
            label: "ChatGPT product feed",
            body: "To connect feed management to the new AI visibility layer.",
          },
          {
            href: "/tarifs",
            label: "FeedPlug pricing",
            body: "The natural destination for visitors already convinced by the simpler positioning.",
          },
        ],
        ctaTitle: "Do you want to win on clarity rather than complexity?",
        ctaBody:
          "FeedPlug is not trying to promise everything to everyone. The product is built to make the catalog cleaner, priorities clearer, and distribution healthier across the channels that matter now and next.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "See if FeedPlug fits your workflow",
      },
      es: {
        backLabel: "Volver al inicio",
        eyebrow: "Comparativa herramientas feed",
        title: "Que herramienta de feed de productos elegir en 2026?",
        subtitle:
          "El mercado mezcla necesidades muy distintas bajo una misma etiqueta: distribucion multicanal, operativa marketplace, motores de reglas, auditoria de catalogo y ahora preparacion para canales IA. FeedPlug quiere ganar en un terreno mas simple: catalogos mas limpios, prioridades mas claras y difusion mas rapida.",
        primaryHref: "/demo?source=use_case_demo",
        primaryLabel: "Solicitar una demo",
        secondaryHref: "/integrations",
        secondaryLabel: "Ver integraciones",
        heroStats: [
          { value: "1 base", label: "Catalogo unificado", detail: "Una fuente unica antes de adaptar cada destino." },
          { value: "0-100", label: "Score de calidad", detail: "Una lectura simple de cuan preparada esta cada ficha." },
          { value: "SEO + GEO", label: "Nuevo requisito", detail: "El feed ahora tambien debe servir a buscadores y asistentes IA." },
        ],
        asideEyebrow: "Resumen",
        quickTitle: "El criterio correcto de compra",
        quickIntro:
          "La mejor herramienta no es la que acumula mas capas. Es la que encaja con tu complejidad real y hace evidentes las siguientes acciones.",
        quickBullets: [
          "Si buscas claridad, FeedPlug tiene un angulo mas fuerte que las suites historicas mas pesadas.",
          "Si necesitas sobre todo un motor de reglas denso o una operativa marketplace muy madura, otras plataformas pueden seguir siendo la mejor opcion.",
          "Los canales IA ya cambian el juego: el catalogo debe ser mas interpretable, mas limpio y mas facil de citar.",
        ],
        fitTitle: "Como leer la categoria sin mezclarlo todo?",
        fitIntro:
          "En vez de preguntar que plataforma es objetivamente mejor, conviene preguntar cual encaja mejor con tu complejidad, tus canales y la forma real de trabajar del equipo.",
        feedplugTitle: "FeedPlug es mejor si...",
        feedplugBullets: [
          "quieres un catalogo mas limpio y mas eficaz rapido sin desplegar una pila pesada de feeds",
          "necesitas score de calidad, auditoria de feed y prioridades claras de correccion",
          "quieres cubrir Google Shopping, marketplaces y nuevas superficies IA a la vez",
        ],
        otherTitle: "Las plataformas mas pesadas son mejores si...",
        otherBullets: [
          "ya operas logicas avanzadas de reglas, procesos especializados y un equipo preparado para ello",
          "tu entorno ya esta muy centrado en operativa marketplace o capas complejas de configuracion",
          "aceptas una curva de aprendizaje mas larga a cambio de mayor profundidad",
        ],
        tableTitle: "Comparativa simplificada del mercado",
        tableIntro:
          "Esta vista ayuda a separar el territorio de FeedPlug del de plataformas mas densas como Channable, Shoppingfeed u otros actores establecidos.",
        tableFirstColumnLabel: "Criterio",
        columnLabels: {
          feedplug: "FeedPlug",
          other: "Plataformas historicas mas pesadas",
        },
        rows: [
          {
            label: "Promesa central",
            feedplug: "Claridad, score de calidad, auditoria de feed y publicacion multicanal mas directa.",
            other: "Cobertura mas amplia de reglas complejas y entornos ya especializados.",
          },
          {
            label: "Tiempo a primer valor",
            feedplug: "Busca valor mas rapido y visibilidad inmediata de prioridades.",
            other: "Puede requerir mas configuracion, formacion o estructura interna.",
          },
          {
            label: "Visibilidad del dato",
            feedplug: "El catalogo esta en el centro con un flujo mas simple y data-centric.",
            other: "La profundidad funcional puede pesar mas que la claridad inmediata.",
          },
          {
            label: "Canales IA",
            feedplug: "Posicionamiento explicito en ChatGPT, asistentes IA y feeds utilizables por LLM.",
            other: "Suele estar mas difuso o tratado de forma secundaria.",
          },
          {
            label: "Narrativa comercial",
            feedplug: "Facil de explicar: catalogo mas limpio, mejor score, difusion mas sana.",
            other: "Mas rica, pero tambien mas dificil de proyectar para equipos menos especializados.",
          },
          {
            label: "Consultas GEO objetivo",
            feedplug: "Alternativa, herramienta simple, auditoria, feed ChatGPT, visibilidad IA.",
            other: "Comparativas historicas y busquedas de reglas avanzadas o marketplaces.",
          },
        ],
        proofTitle: "Por que esta pagina tiene potencial organico",
        proofCards: [
          {
            title: "Capta consultas amplias de recomendacion",
            body: "Prompts como 'mejor herramienta de feed de productos' necesitan una pagina sintesis que explique como elegir sin jerga innecesaria.",
          },
          {
            title: "Ancla FeedPlug en una categoria",
            body: "Para ser citado por la IA, FeedPlug debe aparecer como opcion creible dentro de la categoria, no solo como una marca aislada.",
          },
          {
            title: "Abre la puerta a comparativas directas",
            body: "Una pagina de categoria alimenta naturalmente 'FeedPlug vs Channable' y 'FeedPlug vs Shoppingfeed', que capturan una intencion mas fuerte.",
          },
          {
            title: "Une SEO clasico y GEO",
            body: "La pagina sirve para busquedas web tradicionales y tambien ofrece bloques claros y citables para motores generativos.",
          },
        ],
        faqTitle: "Preguntas frecuentes",
        faqIntro:
          "Estas preguntas estructuran bien lo que ChatGPT, Copilot o Google pueden recibir cuando alguien busca software de feed.",
        faqs: [
          {
            question: "Cual es la mejor herramienta de feed de productos?",
            answer:
              "No existe una ganadora universal. La eleccion correcta depende de tu complejidad real, tu necesidad de visibilidad del catalogo, tus canales objetivo y cuanta densidad operativa puede sostener el equipo.",
          },
          {
            question: "Por que FeedPlug puede ser preferible a una plataforma historica?",
            answer:
              "Porque FeedPlug se centra en un trabajo muy claro: limpiar el catalogo, puntuar fichas, sacar prioridades de correccion y difundir mas simple hacia Google, marketplaces y asistentes IA.",
          },
          {
            question: "Hay que pensar ya en canales IA al elegir una plataforma de feed?",
            answer:
              "Si. Los asistentes IA se convierten en nuevas superficies de descubrimiento de producto, asi que conviene elegir una plataforma que ayude a volver el catalogo mas interpretable para ese contexto.",
          },
          {
            question: "Este tipo de pagina ayuda de verdad a la visibilidad en IA?",
            answer:
              "Si, porque responde directamente a una consulta de recomendacion, estructura criterios de eleccion y conecta FeedPlug con alternativas conocidas del mercado.",
          },
        ],
        relatedTitle: "Comparativas para impulsar despues",
        relatedLinks: [
          {
            href: "/feedplug-vs-channable",
            label: "FeedPlug vs Channable",
            body: "Para consultas de alternativa frente a una suite historica mas orientada a reglas.",
          },
          {
            href: "/feedplug-vs-shoppingfeed",
            label: "FeedPlug vs Shoppingfeed",
            body: "Para comparativas mas ligadas a marketplaces, sindicacion y operaciones de catalogo.",
          },
          {
            href: "/feed-produit-chatgpt",
            label: "Feed de productos ChatGPT",
            body: "Para conectar la categoria feed con la nueva capa de visibilidad en IA.",
          },
          {
            href: "/tarifs",
            label: "Precios FeedPlug",
            body: "El destino natural para visitantes ya convencidos por el posicionamiento mas simple.",
          },
        ],
        ctaTitle: "Quieres ganar por claridad y no por complejidad?",
        ctaBody:
          "FeedPlug no intenta prometerlo todo a todo el mundo. El producto busca sobre todo hacer el catalogo mas limpio, las prioridades mas visibles y la difusion mas sana en los canales que importan ahora y despues.",
        ctaHref: "/demo?source=use_case_demo",
        ctaLabel: "Ver si FeedPlug encaja contigo",
      },
    },
  },
} satisfies Record<string, ComparisonPageDefinition>;

export function getComparisonCopy(
  key: keyof typeof comparisonPages,
  locale: string
): ComparisonLandingCopy {
  const lang: Locale = locale === "fr" ? "fr" : locale === "es" ? "es" : "en";
  return comparisonPages[key].copy[lang];
}
