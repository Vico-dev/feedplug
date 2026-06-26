import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const ACCESS_COOKIE = 'fp_access_token';
const REFRESH_COOKIE = 'fp_refresh_token';

// Routes app
const APP_ROUTES = [
  '/login',
  '/register',
  '/onboarding',
  '/choose-plan',
  '/forgot-password',
  '/reset-password',
  '/invitation',
  '/dashboard',
  '/admin',
  '/catalogue',
  '/flux',
  '/markets',
  '/channels',
  '/optimiser',
  '/ia',
  '/rapports',
  '/performance',
  '/scoring-canaux',
  '/notifications',
  '/facturation',
  '/parametres',
  '/sources',
  '/oauth',
  '/embedded',
];

/**
 * Routes destinées à l'iframe Shopify Admin. Auth via session token Shopify
 * (Authorization header) côté API, pas via cookie de session. Doivent autoriser
 * l'embedding dans Shopify Admin via CSP frame-ancestors.
 */
const SHOPIFY_EMBEDDED_PREFIX = '/embedded';

function isEmbeddedRoute(pathname: string) {
  // Routes embedded ne passent pas par [locale], on match donc le prefix brut
  return pathname === SHOPIFY_EMBEDDED_PREFIX || pathname.startsWith(`${SHOPIFY_EMBEDDED_PREFIX}/`);
}

/**
 * Applique les headers d'iframe sur la réponse.
 *  - Routes embedded : autorisent Shopify Admin via CSP frame-ancestors.
 *    On NE PEUT PAS combiner avec X-Frame-Options (qui ne supporte pas
 *    plusieurs origines), donc on l'omet sur ces routes.
 *  - Autres routes : verrouillent contre le clickjacking.
 */
function applyFrameHeaders(response: NextResponse, embedded: boolean) {
  if (embedded) {
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
    );
  } else {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors 'none';"
    );
  }
  return response;
}

// Routes marketing
const MARKETING_ROUTES_PATTERNS = [
  /^\/$/,
  /^\/(?:fr|en|es)\/?$/,
  /^\/(?:fr|en|es)\/optimiser-flux-(google-shopping|amazon|rakuten|cdiscount)\/?$/,
  /^\/(?:fr|en|es)\/diffusion-nouveaux-canaux\/?$/,
  /^\/optimiser-flux-(google-shopping|amazon|rakuten|cdiscount)\/?$/,
  /^\/diffusion-nouveaux-canaux\/?$/,
];

function stripLocalePrefix(pathname: string) {
  return pathname.replace(/^\/(fr|en|es)(?=\/|$)/, '') || '/';
}

function getLocalePrefix(pathname: string) {
  const match = pathname.match(/^\/(fr|en|es)(?=\/|$)/);
  return match ? `/${match[1]}` : '';
}

function isRouteMatch(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isAppPath(pathname: string) {
  const normalizedPathname = stripLocalePrefix(pathname);
  return APP_ROUTES.some((route) => isRouteMatch(normalizedPathname, route));
}

function isLocalDevHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

// next-intl
const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0] || '';
  const port = hostHeader.includes(':') ? hostHeader.split(':')[1] : '';
  const pathname = request.nextUrl.pathname;

  // API/assets
  if (pathname.startsWith('/feedplug-api') || pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/og-image' || pathname === '/logo' || pathname === '/icon' || pathname.startsWith('/icon?')) {
    return NextResponse.next();
  }

  const embedded = isEmbeddedRoute(pathname);

  // Routes embedded Shopify : ni auth cookie, ni i18n routing.
  // L'auth se fait par session token Shopify côté API. La locale est lue par
  // la page elle-même depuis le query param `locale` (envoyé par Shopify Admin).
  if (embedded) {
    return applyFrameHeaders(NextResponse.next(), true);
  }

  // Variante préfixée par la locale (ex: /fr/embedded/channels) : certaines
  // navigations client ajoutent le préfixe locale, ce qui échappe à
  // isEmbeddedRoute et fait tomber la requête dans le gate cookie plus bas →
  // redirect /login DANS l'iframe Shopify (le cookie app.feedplug.com étant
  // tiers, donc non envoyé). On réécrit vers le path embedded canonique
  // (/embedded/..., qui ne vit pas sous [locale]) en préservant les query params.
  const embeddedWithoutLocale = stripLocalePrefix(pathname);
  if (embeddedWithoutLocale !== pathname && isEmbeddedRoute(embeddedWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = embeddedWithoutLocale;
    return applyFrameHeaders(NextResponse.redirect(url, 307), true);
  }

  // Shopify Admin charge parfois l'app sur un path autre que /embedded en
  // injectant ses query params (host base64 + shop myshopify.com). C'est le
  // cas notamment après approbation Managed Pricing (Shopify redirige vers
  // {app}/dashboard?host=...&shop=...). Sans CSP frame-ancestors permissif,
  // le browser bloque l'iframe avec "n'autorise pas la connexion". On
  // redirige donc systématiquement vers /embedded en préservant les params.
  const hostParam = request.nextUrl.searchParams.get('host');
  const shopParam = request.nextUrl.searchParams.get('shop');
  const isShopifyAdminContext =
    Boolean(hostParam) &&
    Boolean(shopParam) &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shopParam || '');
  if (isShopifyAdminContext) {
    const url = request.nextUrl.clone();
    url.pathname = '/embedded';
    return applyFrameHeaders(NextResponse.redirect(url, 302), true);
  }

  // Canonicalisation www
  if (hostname === 'www.feedplug.com') {
    const url = new URL(request.url);
    url.hostname = 'feedplug.com';
    return NextResponse.redirect(url, 301);
  }

  // HTTPS canonique sur host app
  const isAppHost = hostname === 'app.feedplug.com' || hostname.endsWith('.run.app');
  if (isAppHost && port === '3000') {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // Domaines marketing
  const isLocalHost = isLocalDevHost(hostname);
  const isMarketingDomain = 
    hostname === 'feedplug.com' || 
    hostname === 'www.feedplug.com' ||
    isLocalHost;
  
  // Domaine app
  const isAppDomain =
    hostname === 'app.feedplug.com' ||
    (typeof hostname === 'string' && hostname.endsWith('.run.app')) ||
    isLocalHost;
  const isHostedAppDomain =
    hostname === 'app.feedplug.com' ||
    (typeof hostname === 'string' && hostname.endsWith('.run.app'));
  
  const pathnameWithoutLocale = stripLocalePrefix(pathname);
  const localePrefix = getLocalePrefix(pathname);
  const isAppRoute = isAppPath(pathname);
  
  const isMarketingRoute = 
    MARKETING_ROUTES_PATTERNS.some(pattern => pattern.test(pathname)) ||
    (!isAppRoute && !pathname.startsWith('/api') && !pathname.startsWith('/_next'));

  if (isHostedAppDomain && pathnameWithoutLocale === '/') {
    const hasAuthCookie =
      Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
      Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}${hasAuthCookie ? '/dashboard' : '/login'}`;
    return NextResponse.redirect(url, 307);
  }
  
  if (isAppDomain && isAppRoute) {
    const isAppAuthRouteWithoutLocale =
      pathnameWithoutLocale === '/login' ||
      pathnameWithoutLocale === '/register' ||
      pathnameWithoutLocale === '/forgot-password' ||
      pathnameWithoutLocale === '/reset-password' ||
      pathnameWithoutLocale === '/invitation' ||
      pathnameWithoutLocale === '/choose-plan' ||
      pathnameWithoutLocale === '/onboarding' ||
      pathnameWithoutLocale.startsWith('/oauth/');

    if (isAppAuthRouteWithoutLocale) {
      return applyFrameHeaders(NextResponse.next(), false);
    }

    // Gate auth côté serveur sur les routes protégées : sans cookie de session,
    // on redirige vers /login avant de servir la page (évite l'affichage fugace
    // d'une page protégée tant que le contrôle JS n'a pas tourné). La validation
    // réelle du token reste faite par le backend sur chaque appel API.
    const hasAuthCookie =
      Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
      Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
    if (!hasAuthCookie) {
      const url = request.nextUrl.clone();
      url.pathname = `${localePrefix}/login`;
      return NextResponse.redirect(url, 307);
    }

    return applyFrameHeaders(intlMiddleware(request), false);
  }

  if (!isLocalHost && isMarketingDomain && isAppRoute) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = 'app.feedplug.com';
    url.port = ''; // port par défaut HTTPS (443)
    url.pathname = pathnameWithoutLocale;
    return NextResponse.redirect(url, 301);
  }
  
  if (!isLocalHost && isAppDomain && isMarketingRoute) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = 'feedplug.com';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }
  
  // Docs
  const isDocsRoute = pathname === '/docs' || pathname.startsWith('/docs/');
  if (isMarketingDomain && isDocsRoute) {
    return applyFrameHeaders(NextResponse.next(), false);
  }

  if (isMarketingDomain) {
    return applyFrameHeaders(intlMiddleware(request), false);
  }

  if (isAppDomain) {
    return applyFrameHeaders(intlMiddleware(request), false);
  }

  return applyFrameHeaders(NextResponse.next(), false);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
