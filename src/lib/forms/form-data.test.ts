// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formValues, stringField } from "./form-data";

function form(fields: Record<string, string | Blob>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("formValues", () => {
  it("devuelve los campos de texto", () => {
    expect(formValues(form({ fullName: "Ana", note: "" }))).toEqual({ fullName: "Ana", note: "" });
  });

  it("deja afuera los campos internos de Next ($ACTION_...) y los que se piden omitir", () => {
    const data = form({ fullName: "Ana", $ACTION_ID_abc: "", "cf-turnstile-response": "token" });
    expect(formValues(data, ["cf-turnstile-response"])).toEqual({ fullName: "Ana" });
  });

  it("deja afuera los archivos", () => {
    expect(formValues(form({ fullName: "Ana", photo: new Blob(["x"]) }))).toEqual({ fullName: "Ana" });
  });
});

describe("stringField", () => {
  it("devuelve el texto del campo", () => {
    expect(stringField(form({ token: "abc" }), "token")).toBe("abc");
  });

  it("devuelve null si falta o no es texto", () => {
    expect(stringField(form({}), "token")).toBeNull();
    expect(stringField(form({ token: new Blob(["x"]) }), "token")).toBeNull();
  });
});
