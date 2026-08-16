import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-7 pt-14 pb-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text">Réglages</h1>
        <p className="mt-1.5 text-sm leading-[22px] text-text-muted">
          Le provider IA sert à lire, nommer et classer vos documents. Le changement prend effet
          immédiatement.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
