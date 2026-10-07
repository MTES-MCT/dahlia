import { describe, expect, it } from "vitest";
import { toClassificationCsv, type ClassificationChange } from "./classification-csv";

const change = (overrides: Partial<ClassificationChange> = {}): ClassificationChange => ({
  jurisdictionCode: "TA069",
  caseFileNumber: "2600037",
  title: "DALO_Liquidation d'astreinte",
  status: "Terminé",
  update: {
    litigationType: "LIQUIDATION_ASTREINTE",
    rightType: "DALO",
    summary: "Liquidation d'astreinte",
  },
  ruleIds: ["right-type-dalo-explicit", "litigation-liquidation-astreinte"],
  ...overrides,
});

describe("toClassificationCsv", () => {
  it("writes a header and one line per case file", () => {
    expect(toClassificationCsv([change()])).toBe(
      "﻿jurisdictionCode,caseFileNumber,title,status,litigationType,rightType,summary,rules\n" +
        "TA069,2600037,DALO_Liquidation d'astreinte,Terminé,LIQUIDATION_ASTREINTE,DALO,Liquidation d'astreinte," +
        "right-type-dalo-explicit + litigation-liquidation-astreinte\n",
    );
  });

  it("leaves the cells of the attributes that were not deduced empty", () => {
    const csv = toClassificationCsv([
      change({ title: null, update: { rightType: "DAHO" }, ruleIds: ["right-type-daho-explicit"] }),
    ]);
    expect(csv.split("\n")[1]).toBe("TA069,2600037,,Terminé,,DAHO,,right-type-daho-explicit");
  });

  it("quotes the values carrying a comma, a quote or a newline", () => {
    const csv = toClassificationCsv([
      change({ title: 'DALO, "injonction"\nsuite', update: {}, ruleIds: [] }),
    ]);
    expect(csv.split("\n").slice(1, 3).join("\n")).toBe(
      'TA069,2600037,"DALO, ""injonction""\nsuite",Terminé,,,,',
    );
  });

  it("appends the unmatched case files with their number, title and status", () => {
    const csv = toClassificationCsv(
      [change()],
      [
        {
          jurisdictionCode: "TA034",
          caseFileNumber: "2507216",
          title: "POLICE: Suspension permis de conduire",
          status: "En cours",
        },
        { jurisdictionCode: "TA069", caseFileNumber: "2508015", title: null, status: null },
      ],
    );
    expect(csv.split("\n").slice(2, 4)).toEqual([
      "TA034,2507216,POLICE: Suspension permis de conduire,En cours,,,,",
      "TA069,2508015,,,,,,",
    ]);
  });

  it("emits only the header when nothing was classified", () => {
    expect(toClassificationCsv([])).toBe(
      "﻿jurisdictionCode,caseFileNumber,title,status,litigationType,rightType,summary,rules\n",
    );
  });
});
