"use client";

import { Select } from "@codegouvfr/react-dsfr/Select";
import { TABLE_PAGE_SIZES, type TablePageSize } from "@/app/lib/table-page-size";

type Props = {
  pageSize: TablePageSize;
  onChange: (pageSize: TablePageSize) => void;
  className?: string;
};

export function TablePageSizeSelect({ pageSize, onChange, className }: Props) {
  return (
    <Select
      label="Résultats par page"
      className={className}
      nativeSelectProps={{
        value: String(pageSize),
        onChange: (event) => onChange(Number(event.target.value) as TablePageSize),
      }}
    >
      {TABLE_PAGE_SIZES.map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
    </Select>
  );
}
