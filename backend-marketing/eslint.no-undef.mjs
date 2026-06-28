// Config ESLint minimale, dédiée au gate `no-undef` du backend.
//
// Pourquoi : l'extraction des routes en modules (routes/*.js, domains/*) peut
// laisser des symboles non déclarés (ni en deps injectées, ni en require) qui ne
// pètent qu'au RUNTIME, à l'intérieur d'un handler — invisible au route-inventory
// (qui ne valide que l'enregistrement au boot). `no-undef` fait l'analyse de
// portée et les attrape AVANT le déploiement.
//
// Usage local :
//   cd backend-marketing
//   npx --yes eslint@9 --no-config-lookup --config eslint.no-undef.mjs "routes/*.js" "domains/*/*.js" "scoring/*.js"
//
// ESLint reconnaît correctement les params destructurés (deps) et les require :
// il ne flagge donc QUE les vrais symboles non déclarés.
export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        process: "readonly", console: "readonly", Buffer: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
        setInterval: "readonly", clearInterval: "readonly",
        setImmediate: "readonly", queueMicrotask: "readonly",
        __dirname: "readonly", __filename: "readonly",
        URL: "readonly", URLSearchParams: "readonly",
        fetch: "readonly", AbortController: "readonly",
        TextEncoder: "readonly", TextDecoder: "readonly",
        crypto: "readonly", structuredClone: "readonly",
        globalThis: "readonly", FormData: "readonly", Blob: "readonly",
      },
    },
    rules: { "no-undef": "error" },
  },
];
