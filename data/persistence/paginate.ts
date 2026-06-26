import { PagedResponse } from "../telerecours/types";

// Iterate over every page of a paginated Telerecours endpoint. The fetcher
// receives the page number (0-based) and must return a PagedResponse<T>.
export async function* paginate<T>(
  fetcher: (page: number) => Promise<PagedResponse<T>>,
): AsyncGenerator<T> {
  let page = 0;
  while (true) {
    const response = await fetcher(page);
    for (const item of response.content) {
      yield item;
    }
    const totalPages = response.page?.totalPages ?? 1;
    if (page + 1 >= totalPages) return;
    page += 1;
  }
}
