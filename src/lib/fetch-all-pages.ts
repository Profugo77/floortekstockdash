type PageResult<T> = { data: T[] | null; error: { message: string } | null };

// Each request stays below the Data API row cap; no age or total-history limit.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}