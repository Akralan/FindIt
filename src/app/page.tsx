"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentRecord, DocumentSummary, SearchResult } from "@/lib/types";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DocumentGrid } from "@/components/DocumentGrid";
import { DocumentModal } from "@/components/DocumentModal";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter, type CategoryFilterItem } from "@/components/CategoryFilter";
import { useToast } from "@/components/ui/Toast";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [categories, setCategories] = useState<CategoryFilterItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
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
  const scoreMap = useMemo(() => {
    if (!searchResults) return {};
    return Object.fromEntries(searchResults.map((result) => [result.document.id, result.score]));
  }, [searchResults]);
  const searchDocuments = useMemo(
    () => searchResults?.map((result) => result.document) ?? [],
    [searchResults]
  );

  const hasNoDocumentsAtAll = !loadingDocuments && documents.length === 0 && !selectedCategory;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-text">Tableau de bord</h1>
        <p className="mt-1 text-sm text-text-muted">
          Déposez un document, FindIt le classe et le range automatiquement.
        </p>
      </div>

      <UploadDropzone onUploaded={handleUploaded} />

      <SearchBar onResults={setSearchResults} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            loading={loadingCategories}
          />
        </aside>

        <div className="flex flex-col gap-10">
          {isSearchActive ? (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Résultats de recherche
              </h2>
              <DocumentGrid
                documents={searchDocuments}
                onOpen={handleOpen}
                scores={scoreMap}
                emptyState={
                  <>
                    <p className="text-sm font-medium text-text">Aucun résultat</p>
                    <p className="mt-1 text-sm text-text-muted">
                      Essayez une autre formulation ou vérifiez l&apos;orthographe.
                    </p>
                  </>
                }
              />
            </section>
          ) : (
            <>
              {(loadingDocuments || pendingDocuments.length > 0) && (
                <section>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">
                    À valider
                  </h2>
                  <DocumentGrid
                    documents={pendingDocuments}
                    loading={loadingDocuments}
                    skeletonCount={3}
                    onOpen={handleOpen}
                    onValidate={handleValidate}
                    onReject={handleReject}
                    emptyState={null}
                  />
                </section>
              )}

              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Documents
                </h2>
                <DocumentGrid
                  documents={confirmedDocuments}
                  loading={loadingDocuments}
                  onOpen={handleOpen}
                  emptyState={
                    hasNoDocumentsAtAll ? (
                      <>
                        <p className="text-base font-medium text-text">Bienvenue dans FindIt</p>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
                          Déposez vos premiers documents ci-dessus (factures, contrats, courriers...).
                          FindIt les lit, les nomme et les range automatiquement dans la bonne
                          catégorie — il ne vous restera qu&apos;à valider.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-text">Aucun document confirmé</p>
                        <p className="mt-1 text-sm text-text-muted">
                          {selectedCategory
                            ? "Aucun document confirmé dans cette catégorie."
                            : "Validez les documents en attente pour les voir apparaître ici."}
                        </p>
                      </>
                    )
                  }
                />
              </section>
            </>
          )}
        </div>
      </div>

      <DocumentModal
        documentId={selectedDocumentId}
        onClose={() => setSelectedDocumentId(null)}
        onChanged={handleModalChanged}
        onDeleted={handleModalDeleted}
      />
    </div>
  );
}
