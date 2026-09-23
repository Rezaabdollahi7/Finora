import { describe, expect, it } from "vitest";

import {
  hasMembers,
  ownerLabel,
  ownerOptions,
  type MemberDto,
} from "@/features/members/types";

const sara: MemberDto = {
  id: "m1",
  name: "سارا",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("owner options", () => {
  it("offers only the household when nobody has been added", () => {
    expect(ownerOptions([])).toEqual([{ value: "SHARED", label: "مشترک" }]);
    expect(hasMembers([])).toBe(false);
  });

  it("lists the household first, then the people", () => {
    expect(ownerOptions([sara]).map((option) => option.label)).toEqual([
      "مشترک",
      "سارا",
    ]);
    expect(hasMembers([sara])).toBe(true);
  });

  it("names an owner, and never shows a blank for a stale id", () => {
    expect(ownerLabel("SHARED", [sara])).toBe("مشترک");
    expect(ownerLabel("m1", [sara])).toBe("سارا");
    expect(ownerLabel("gone", [sara])).toBe("عضو خانوار");
  });
});
