"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { type CaseFileTabId } from "@/app/lib/case-file-tabs";

type Props = {
  selectedTabId: CaseFileTabId;
  children: React.ReactNode;
};

export function CaseFileTabNav({ selectedTabId, children }: Props) {
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
        { tabId: "pieces", label: "Pièces" },
        { tabId: "historique", label: "Historique" },
        { tabId: "debug", label: "Debug" },
      ]}
      className={fr.cx("fr-mb-3w")}
      classes={{
        panel: selectedTabId === "pieces" ? clsx("!p-0") : undefined,
      }}
    >
      {children}
    </Tabs>
  );
}
