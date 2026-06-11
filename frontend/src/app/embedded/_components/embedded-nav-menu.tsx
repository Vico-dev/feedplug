"use client";

import { NavMenu } from "@shopify/app-bridge-react";
import Link from "next/link";

/**
 * Menu de navigation App Bridge — affiché dans la barre latérale gauche de
 * Shopify Admin quand l'app est ouverte.
 *
 * Convention Shopify : la 1re entrée (sans rel="home" explicite) est traitée
 * comme l'accueil par App Bridge. Les autres entrées sont des liens classiques
 * vers les sous-pages /embedded/*.
 *
 * Remarque : on utilise `next/link` pour garder le routing client-side dans
 * l'iframe et éviter un reload complet à chaque navigation (important pour
 * les Web Vitals BFS).
 */
export function EmbeddedNavMenu() {
  return (
    <NavMenu>
      <Link href="/embedded" rel="home">
        Accueil
      </Link>
      <Link href="/embedded/billing">Facturation</Link>
      <Link href="/embedded/channels">Canaux</Link>
      <Link href="/embedded/sources">Catalogue</Link>
      <Link href="/embedded/diagnostic">Diagnostic</Link>
      <Link href="/embedded/performance">Performance</Link>
    </NavMenu>
  );
}
