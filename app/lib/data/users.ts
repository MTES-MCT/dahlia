import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { parseSearchQuery } from "@/app/lib/case-file-search";
import { type JurisdictionListRow } from "@/app/lib/data/jurisdictions";
import {
  USERS_DEFAULT_ORDER,
  USERS_DEFAULT_SORT_BY,
  USERS_FACET_KEYS,
  USERS_PARAMS,
  type UsersFacetKey,
} from "@/app/lib/users-table";
import { buildWordAndFilter, combineAnd, facetSearchWords } from "@/app/lib/search-where";
import {
  fetchPaginatedTableData,
  resolveTablePageSize,
  type PaginatedTableData,
} from "@/app/lib/fetch-paginated-table-data";
import { type SortOrder } from "@/app/lib/table-sort";
import { parseTableQueryState } from "@/app/lib/table-query-state";

export type UserListRow = Pick<
  User,
  "id" | "firstName" | "lastName" | "email" | "isValidated" | "isAdmin" | "createdAt"
> & {
  // Permission scope: jurisdictions the user is allowed to work on (may be empty).
  jurisdictions: JurisdictionListRow[];
};

function toSortOrder(sortOrder: SortOrder): Prisma.SortOrder {
  return sortOrder === "ascending" ? "asc" : "desc";
}

function buildUsersOrderBy(
  sortBy: string,
  direction: Prisma.SortOrder,
): Prisma.UserOrderByWithRelationInput {
  switch (sortBy) {
    case "firstName":
      return { firstName: { sort: direction, nulls: "last" } };
    case "email":
      return { email: direction };
    case "lastName":
    default:
      return { lastName: { sort: direction, nulls: "last" } };
  }
}

function textContainsFilter(field: "firstName" | "lastName" | "email", word: string) {
  return { [field]: { contains: word, mode: "insensitive" as const } };
}

function buildFreeTextFilter(freeText: string): Prisma.UserWhereInput {
  const words = facetSearchWords(freeText);
  return buildWordAndFilter(words, (word) => ({
    OR: [
      textContainsFilter("lastName", word),
      textContainsFilter("firstName", word),
      textContainsFilter("email", word),
    ],
  }));
}

const FACET_BUILDERS: Record<UsersFacetKey, (rawValue: string) => Prisma.UserWhereInput> = {
  nom: (raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => textContainsFilter("lastName", word)),
  prenom: (raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => textContainsFilter("firstName", word)),
  email: (raw) =>
    buildWordAndFilter(facetSearchWords(raw), (word) => textContainsFilter("email", word)),
};

function buildUsersWhere(query: string | null): Prisma.UserWhereInput {
  if (!query) return {};

  const conditions: Prisma.UserWhereInput[] = [];
  const { freeText, facets } = parseSearchQuery(query, USERS_FACET_KEYS);

  if (freeText) {
    conditions.push(buildFreeTextFilter(freeText));
  }

  for (const facet of facets) {
    conditions.push(FACET_BUILDERS[facet.key as UsersFacetKey](facet.value));
  }

  return combineAnd(conditions);
}

async function fetchUsersPage(
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: SortOrder,
  query: string | null,
): Promise<UserListRow[]> {
  const users = await prisma.user.findMany({
    where: buildUsersWhere(query),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isValidated: true,
      isAdmin: true,
      createdAt: true,
      jurisdictionScopes: {
        select: {
          jurisdiction: { select: { id: true, name: true, shortName: true } },
        },
        orderBy: { jurisdiction: { shortName: "asc" } },
      },
    },
    orderBy: buildUsersOrderBy(sortBy, toSortOrder(sortOrder)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Flatten the join rows so consumers only see the jurisdictions themselves.
  return users.map(({ jurisdictionScopes, ...user }) => ({
    ...user,
    jurisdictions: jurisdictionScopes.map((scope) => scope.jurisdiction),
  }));
}

async function fetchUsersCount(query: string | null): Promise<number> {
  return prisma.user.count({ where: buildUsersWhere(query) });
}

export type UsersTableData = PaginatedTableData<UserListRow>;

export async function fetchUsersTableData(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<UsersTableData> {
  const { page, sortBy, sortOrder, query } = parseTableQueryState(searchParams, USERS_PARAMS, {
    defaultSortBy: USERS_DEFAULT_SORT_BY,
    defaultOrder: USERS_DEFAULT_ORDER,
  });
  const pageSize = await resolveTablePageSize("users");

  return fetchPaginatedTableData({
    page,
    pageSize,
    fetchPage: () => fetchUsersPage(page, pageSize, sortBy, sortOrder, query),
    fetchCount: () => fetchUsersCount(query),
  });
}
