import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";
import { TariffList } from "@/components/TariffList";
import { getSettings, listAllTariffs } from "@/lib/actions/settings";

export const metadata: Metadata = { title: "Einstellungen – Verwaltung" };

export default async function SettingsPage() {
  const [settings, tariffs] = await Promise.all([getSettings(), listAllTariffs()]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Einstellungen</h1>
          <p className="sub">Rechnungsdaten, Steuerangaben und Tarife.</p>
        </div>
      </div>
      <SettingsForm settings={settings} />
      <TariffList tariffs={tariffs} />
    </>
  );
}
