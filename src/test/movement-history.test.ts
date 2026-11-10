import { describe, it, expect } from "vitest";
import { fetchAllPages } from "@/lib/fetch-all-pages";

describe("permanent movement history", () => {
  it("keeps movements older than 30 days available beyond the first 200 and 1000 records", async () => {
    const records = Array.from({ length: 1483 }, (_, id) => ({
      id,
      fecha: id < 167 ? "2026-11-07" : "2026-03-02",
    }));
    const result = await fetchAllPages(async (from, to) => ({
      data: records.slice(from, to + 1), error: null,
    }));
    expect(result).toHaveLength(1483);
    expect(result.filter(row => row.fecha < "2026-10-11")).toHaveLength(1316);
    expect(result.at(-1)).toEqual({ id: 1482, fecha: "2026-03-02" });
  });

  it("does not silently show incomplete history after a failed page", async () => {
    await expect(fetchAllPages(async () => ({
      data: null, error: { message: "History unavailable" },
    }))).rejects.toThrow("History unavailable");
  });
});