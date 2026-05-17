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
];

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
      return NextResponse.next();
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

    return intlMiddleware(request);
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
    return NextResponse.next();
  }

  if (isMarketingDomain) {
    return intlMiddleware(request);
  }

  if (isAppDomain) {
    return intlMiddleware(request);
  }

  return NextResponse.next();
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
