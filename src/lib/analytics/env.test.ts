// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clarityProjectId, gaMeasurementId } from "./env";

describe("gaMeasurementId", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  afterEach(() => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = ORIGINAL;
  });

  it("devuelve null si no está configurada", () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    expect(gaMeasurementId()).toBeNull();
  });

  it("devuelve el valor cuando está configurada", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-LJRKLSP787";
    expect(gaMeasurementId()).toBe("G-LJRKLSP787");
  });
});

describe("clarityProjectId", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = ORIGINAL;
  });

  it("devuelve null si no está configurada", () => {
    expect(clarityProjectId()).toBeNull();
  });

  it("devuelve el valor cuando está configurada", () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = "abc123xyz0";
    expect(clarityProjectId()).toBe("abc123xyz0");
  });
});
