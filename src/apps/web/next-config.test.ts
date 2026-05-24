import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("web dev server config", () => {
  it("allows the 127.0.0.1 dev origin used for local browser previews", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
