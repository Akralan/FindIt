/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // "standalone" produit un serveur autonome (.next/standalone/server.js)
  // avec uniquement les dépendances réellement tracées, au lieu d'embarquer
  // tout node_modules. C'est ce bundle que l'app Electron (voir electron/)
  // lance dans un processus Node séparé pour produire l'installeur Windows.
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
      "node-llama-cpp",
      "tesseract.js",
    ],
    // Le traceur de fichiers de Next rate parfois les binaires natifs
    // chargés dynamiquement (bindings .node de @napi-rs/canvas et
    // node-llama-cpp) : on force leur inclusion dans le bundle standalone.
    outputFileTracingIncludes: {
      // Filet de sécurité : force l'inclusion des bindings natifs si le
      // traceur venait à les rater. En pratique, node-llama-cpp liste
      // TOUTES ses plateformes (win/mac/linux, cuda, vulkan...) en
      // optionalDependencies et le traceur les copie donc déjà toutes —
      // c'est scripts/assemble-standalone.mjs qui élague ensuite pour ne
      // garder que win-x64 (CPU), seule cible de l'installeur Windows.
      "/**/*": [
        "node_modules/@napi-rs/canvas-win32-x64-msvc/**",
        "node_modules/node-llama-cpp/dist/**",
      ],
    },
    // "electron" est un devDependency (coquille desktop, voir electron/) :
    // aucune route serveur ne l'importe, mais le traceur statique le
    // détecte via des require() conditionnels (détection d'environnement)
    // dans des dépendances tierces et embarquerait sinon ~270 Mo pour
    // rien — le binaire Electron réel est fourni séparément par
    // electron-builder, pas par ce node_modules.
    outputFileTracingExcludes: {
      "/**/*": ["node_modules/electron/**", "node_modules/electron-builder/**"],
    },
  },
};

export default nextConfig;
