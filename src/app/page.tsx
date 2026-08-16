"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentRecord, DocumentSummary, SearchResult } from "@/lib/types";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DocumentList } from "@/components/DocumentList";
import { DocumentModal } from "@/components/DocumentModal";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter, type CategoryFilterItem } from "@/components/CategoryFilter";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [categories, setCategories] = useState<CategoryFilterItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [bulkValidating, setBulkValidating] = useState(false);
  const { showToast } = useToast();

  const fetchDocuments = useCallback(
    async (category: string | null) => {
      setLoadingDocuments(true);
      try {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        const query = params.toString();
        const res = await fetch(`/api/documents${query ? `?${query}` : ""}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Impossible de charger les documents.");
        setDocuments((data.documents ?? []) as DocumentSummary[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible de charger les documents.";
        showToast(message, "error");
      } finally {
        setLoadingDocuments(false);
      }
    },
    [showToast]
  );

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch("/api/documents/categories");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Impossible de charger les catégories.");
      setCategories((data.categories ?? []) as CategoryFilterItem[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de charger les catégories.";
      showToast(message, "error");
    } finally {
      setLoadingCategories(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchDocuments(selectedCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const pendingDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "pending_review"),
    [documents]
  );
  const confirmedDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "confirmed"),
    [documents]
  );

  function refreshAll() {
    void fetchDocuments(selectedCategory);
    void fetchCategories();
  }

  function handleUploaded(_uploaded: DocumentRecord[]) {
    refreshAll();
  }

  async function handleValidate(doc: DocumentSummary) {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec de la validation.");
      showToast("Document validé.", "success");
      refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de la validation.";
      showToast(message, "error");
    }
  }

  async function handleBulkValidate() {
    if (pendingDocuments.length === 0) return;
    setBulkValidating(true);
    let failures = 0;
    for (const doc of pendingDocuments) {
      try {
        const res = await fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "confirmed" }),
        });
        if (!res.ok) failures += 1;
      } catch {
        failures += 1;
      }
    }
    setBulkValidating(false);
    if (failures === 0) {
      showToast(
        pendingDocuments.length > 1
          ? `${pendingDocuments.length} documents validés.`
          : "Document validé.",
        "success"
      );
    } else {
      showToast(`${failures} document(s) n'ont pas pu être validés.`, "error");
    }
    refreshAll();
  }

  async function handleReject(doc: DocumentSummary) {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec du rejet.");
      showToast("Document rejeté et déplacé vers la corbeille.", "success");
      refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec du rejet.";
      showToast(message, "error");
    }
  }

  function handleOpen(doc: DocumentSummary) {
    setSelectedDocumentId(doc.id);
  }

  function handleModalChanged(_updated: DocumentRecord) {
    refreshAll();
  }

  function handleModalDeleted(_id: string) {
    refreshAll();
  }

  const isSearchActive = searchResults !== null;
  const searchDocuments = useMemo(
    () => searchResults?.map((result) => result.document) ?? [],
    [searchResults]
  );

  const hasNoDocumentsAtAll = !loadingDocuments && documents.length === 0 && !selectedCategory;
  const showEmptyState = hasNoDocumentsAtAll && !isSearchActive;

  if (showEmptyState) {
    return (
      <div className="flex flex-col items-center gap-8 pt-24 pb-8 text-center">
        <div className="flex flex-col items-center gap-3.5">
          <h1 className="max-w-[22ch] text-[32px] font-semibold leading-[40px] tracking-tight text-text">
            Vos papiers, rangés sans y penser
          </h1>
          <p className="max-w-[52ch] text-[15px] leading-6 text-text-muted">
            Déposez vos premiers documents — factures, contrats, courriers. FindIt les lit, les nomme, les
            classe. Il ne vous restera qu&apos;à valider.
          </p>
        </div>

        <div className="w-full max-w-[620px]">
          <UploadDropzone onUploaded={handleUploaded} variant="full" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-7 text-[13px] text-text-muted">
          <span>1 · Vous déposez</span>
          <span className="text-text-faint">→</span>
          <span>2 · L&apos;IA nomme et classe</span>
          <span className="text-text-faint">→</span>
          <span>3 · Vous validez</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-11 pt-10 pb-8">
      {/* Un seul <SearchBar> monté en permanence, à la même position dans l'arbre :
          basculer entre deux instances distinctes (une par branche) lui ferait perdre
          son état interne de saisie à chaque activation/désactivation de la recherche. */}
      <div className={isSearchActive ? "flex flex-col gap-4" : "flex flex-col items-center gap-5 text-center"}>
        {!isSearchActive && (
          <h1 className="text-[30px] font-semibold leading-[38px] tracking-tight text-text">
            Que cherchez-vous ?
          </h1>
        )}
        <div className={isSearchActive ? "w-full" : "w-full max-w-[620px]"}>
          <SearchBar onResults={setSearchResults} />
        </div>
        {isSearchActive && (
          <>
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-sm font-semibold text-text">Résultats</h2>
              <span className="text-[13px] text-text-muted">
                {searchDocuments.length === 0
                  ? "aucun résultat"
                  : searchDocuments.length === 1
                    ? "1 document"
                    : `${searchDocuments.length} documents`}
              </span>
            </div>
            <DocumentList
              documents={searchDocuments}
              variant="search"
              onOpen={handleOpen}
              emptyState={
                <>
                  <p className="text-[15px] font-medium text-text">Aucun résultat</p>
                  <p className="max-w-[44ch] text-[13px] leading-5 text-text-muted">
                    Essayez une autre formulation, ou décrivez le document plutôt que son nom de fichier.
                  </p>
                </>
              }
            />
          </>
        )}
      </div>

      {!isSearchActive && (
        <>
          <UploadDropzone onUploaded={handleUploaded} variant="compact" />

          {(loadingDocuments || pendingDocuments.length > 0) && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-block h-[7px] w-[7px] flex-none rounded-full bg-warning-dot" />
                <h2 className="text-sm font-semibold text-text">À valider</h2>
                <span className="text-[13px] text-text-muted">
                  {pendingDocuments.length > 0
                    ? `${pendingDocuments.length} en attente`
                    : ""}
                </span>
                {pendingDocuments.length > 1 && (
                  <Button
                    size="sm"
                    variant="dark"
                    className="ml-auto"
                    isLoading={bulkValidating}
                    onClick={handleBulkValidate}
                  >
                    Tout valider
                  </Button>
                )}
              </div>
              <DocumentList
                documents={pendingDocuments}
                variant="pending"
                loading={loadingDocuments}
                skeletonCount={3}
                onOpen={handleOpen}
                onValidate={handleValidate}
                onReject={handleReject}
              />
            </section>
          )}

          <section className="flex flex-col gap-4">
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              loading={loadingCategories}
            />
            <DocumentList
              documents={confirmedDocuments}
              variant="library"
              loading={loadingDocuments}
              onOpen={handleOpen}
              emptyState={
                <>
                  <p className="text-sm font-medium text-text">Aucun document confirmé</p>
                  <p className="mt-1 text-sm text-text-muted">
                    {selectedCategory
                      ? "Aucun document confirmé dans cette catégorie."
                      : "Validez les documents en attente pour les voir apparaître ici."}
                  </p>
                </>
              }
            />
          </section>
        </>
      )}

      <DocumentModal
        documentId={selectedDocumentId}
        onClose={() => setSelectedDocumentId(null)}
        onChanged={handleModalChanged}
        onDeleted={handleModalDeleted}
      />
    </div>
  );
}
