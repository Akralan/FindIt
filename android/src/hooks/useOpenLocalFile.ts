import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { openFileExternally } from "@/storage/fileStorage";
import type { LocalDocument } from "@/types/document";

/**
 * Ouvre le fichier local d'un document avec l'application système appropriée
 * (`openFileExternally`, déjà existant — voir `src/storage/fileStorage.ts`).
 * Rien n'est demandé au PC : le fichier est déjà copié sur le téléphone.
 */
export function useOpenLocalFile() {
  const [isOpening, setIsOpening] = useState(false);

  const openDocument = useCallback(async (document: LocalDocument) => {
    setIsOpening(true);
    try {
      await openFileExternally(document.localFilePath, document.mimeType);
    } catch {
      Alert.alert("Impossible d'ouvrir le fichier", "Aucune application compatible n'a été trouvée sur cet appareil.");
    } finally {
      setIsOpening(false);
    }
  }, []);

  return { isOpening, openDocument };
}
