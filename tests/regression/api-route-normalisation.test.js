import { describe, expect, test } from "vitest";
import { GET } from "../../api/[...path].js";

describe("consolidated API route normalisation", () => {
  test("collapses repeated path separators before route matching", async () => {
    const response = await GET(new Request("https://www.daxora.co.uk//api//health//"));
    expect(response.status).not.toBe(404);
  });

  test("keeps unknown routes closed", async () => {
    const response = await GET(new Request("https://www.daxora.co.uk//api//not-real"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "API_ROUTE_NOT_FOUND" });
  });
});
