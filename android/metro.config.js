// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Empêche Metro de surveiller/indexer les dossiers de build natifs
// (Gradle/CMake) sous android/android et node_modules/*/android. Ces
// dossiers sont recréés/vidés à chaque build natif (gradlew assembleDebug,
// expo prebuild --clean...) — le watcher de fichiers de Metro plante sinon
// (ENOENT sur des répertoires qui disparaissent pendant qu'il les
// surveille), ce qui a fait tomber le serveur Metro plusieurs fois pendant
// le développement de la synchro.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /android[\\/]android[\\/].*[\\/]build[\\/].*/,
  /android[\\/]android[\\/].*[\\/]\.cxx[\\/].*/,
  /node_modules[\\/].*[\\/]android[\\/]build[\\/].*/,
  /node_modules[\\/].*[\\/]android[\\/]\.cxx[\\/].*/,
];

module.exports = config;
