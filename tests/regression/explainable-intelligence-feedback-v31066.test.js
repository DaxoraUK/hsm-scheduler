import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const guidanceSource = readFileSync("src/components/Operations/shared/MatchdayGuidanceCard.jsx", "utf8");
const pageSource = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

describe("explainable intelligence feedback", () => {
  it("shows confidence, evidence and likely benefit", () => {
    expect(guidanceSource).toContain("% confidence");
    expect(guidanceSource).toContain("Likely benefit:");
    expect(guidanceSource).toContain("item.evidence.map");
  });

  it("records useful and dismissed responses in a club and day scoped preference", () => {
    expect(guidanceSource).toContain('response, recordedAt: new Date().toISOString()');
    expect(guidanceSource).toContain('onRespond(item, "useful")');
    expect(guidanceSource).toContain('onRespond(item, "dismissed")');
    expect(pageSource).toContain('daxora:intelligence-feedback:${props.activeClubId || "club"}:${day.toLowerCase()}');
  });

  it("does not offer feedback controls to users without operating authority", () => {
    expect(pageSource).toContain("canRespond={props.workspaceAccess?.canOperate !== false}");
    expect(guidanceSource).toContain("{onRespond ?");
  });
});
