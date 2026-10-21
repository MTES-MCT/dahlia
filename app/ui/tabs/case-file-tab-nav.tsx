"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { type CaseFileTabId } from "@/app/lib/case-file-tabs";

type Props = {
  selectedTabId: CaseFileTabId;
  eventCount: number;
  pieceCount: number;
  showDebugTab?: boolean;
  children: React.ReactNode;
};

export function CaseFileTabNav({
  selectedTabId,
  eventCount,
  pieceCount,
  showDebugTab = false,
  children,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabChange(tabId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs
      selectedTabId={selectedTabId}
      onTabChange={handleTabChange}
      tabs={[
        { tabId: "synthese", label: "Synthèse", iconId: "fr-icon-folder-2-line" },
        {
          tabId: "historique",
          label: `Historique (${eventCount})`,
          iconId: "fr-icon-time-line",
        },
        { tabId: "pieces", label: `Pièces (${pieceCount})`, iconId: "fr-icon-file-text-line" },
        ...(showDebugTab ? [{ tabId: "debug" as const, label: "Debug" }] : []),
      ]}
      className={fr.cx("fr-mb-1w")}
      classes={{
        panel: selectedTabId === "pieces" ? clsx("!p-0") : undefined,
      }}
    >
      {children}
    </Tabs>
  );
}
