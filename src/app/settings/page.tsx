import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-text">Réglages</h1>
        <p className="mt-1 text-sm text-text-muted">
          Configurez le provider IA utilisé pour classer et rechercher vos documents.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
