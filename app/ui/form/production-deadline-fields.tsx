"use client";

import { useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import {
  PRODUCTION_DEADLINE_TYPE_OPTIONS,
  PRODUCTION_DEADLINE_TYPE_UNDEFINED_VALUE,
  type ProductionDeadlineType,
} from "@/app/lib/case-file-enums";
import {
  formatDateInputValue,
  isDateInputBeforeToday,
  PRODUCTION_DEADLINE_DATE_IN_PAST_WARNING,
} from "@/app/lib/case-file-format";

// Échéance à produire (type + deadline) of a case file under instruction, in the
// "Qualification du dossier" form.
export function ProductionDeadlineFields({
  productionDeadlineType,
  productionDeadlineDate,
}: {
  productionDeadlineType: ProductionDeadlineType | null;
  productionDeadlineDate: Date | null;
}) {
  const initialType = productionDeadlineType ?? PRODUCTION_DEADLINE_TYPE_UNDEFINED_VALUE;
  const [selectedType, setSelectedType] = useState(initialType);
  const [dateValue, setDateValue] = useState(formatDateInputValue(productionDeadlineDate));
  const hasDeadlineType = selectedType !== PRODUCTION_DEADLINE_TYPE_UNDEFINED_VALUE;
  const dateWarning =
    hasDeadlineType && dateValue && isDateInputBeforeToday(dateValue)
      ? PRODUCTION_DEADLINE_DATE_IN_PAST_WARNING
      : null;

  return (
    <>
      <input type="hidden" name="hasProductionDeadlineFields" value="true" />

      <div
        className={clsx(
          fr.cx("fr-mb-1w"),
          "flex flex-wrap items-start justify-start gap-x-4 gap-y-2",
        )}
      >
        <RadioButtons
          legend="Échéance à produire"
          name="productionDeadlineType"
          orientation="horizontal"
          options={PRODUCTION_DEADLINE_TYPE_OPTIONS.map((option) => ({
            label: option.label,
            nativeInputProps: {
              value: option.value,
              defaultChecked: initialType === option.value,
              onChange: () => setSelectedType(option.value),
            },
          }))}
        />

        <Input
          label="Date limite de production"
          disabled={!hasDeadlineType}
          state={dateWarning ? "error" : "default"}
          stateRelatedMessage={dateWarning ?? undefined}
          nativeInputProps={{
            type: "date",
            name: "productionDeadlineDate",
            value: dateValue,
            onChange: (event) => setDateValue(event.currentTarget.value),
          }}
          className="shrink-0"
        />
      </div>
    </>
  );
}
