import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Sin globals de Vitest, Testing Library no limpia el DOM sola entre tests.
afterEach(() => {
  cleanup();
});
