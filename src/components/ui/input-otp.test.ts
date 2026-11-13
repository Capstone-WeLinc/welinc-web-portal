import { describe, it, expect } from "vitest";
import { digitsOnly } from "./input-otp";

// covers: pasting a code copied from an email into the code boxes

describe("digitsOnly", () => {
  it("keeps only the digits of a pasted code", () => {
    expect(digitsOnly("321393")).toBe("321393");
    expect(digitsOnly(" 321 393\n")).toBe("321393");
    expect(digitsOnly("Code: 321-393")).toBe("321393");
    expect(digitsOnly("no digits")).toBe("");
  });
});
