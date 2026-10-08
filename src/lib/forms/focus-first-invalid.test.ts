import { afterEach, describe, expect, it } from "vitest";
import { focusFirstInvalid } from "./focus-first-invalid";

function form(html: string) {
  const element = document.createElement("form");
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

afterEach(() => document.body.replaceChildren());

describe("focusFirstInvalid", () => {
  it("lleva el foco al primer campo inválido en el orden de la página", () => {
    const f = form(`
      <input name="fullName" />
      <input name="whatsapp" aria-invalid="true" />
      <select name="city" aria-invalid="true"></select>
    `);
    focusFirstInvalid(f);
    expect(document.activeElement?.getAttribute("name")).toBe("whatsapp");
  });

  it("en un grupo de radios inválido enfoca la primera opción habilitada (un fieldset no recibe foco)", () => {
    const f = form(`
      <fieldset aria-invalid="true">
        <input type="radio" name="paymentMethod" value="cash" disabled />
        <input type="radio" name="paymentMethod" value="transfer" />
      </fieldset>
      <input name="whatsapp" aria-invalid="true" />
    `);
    focusFirstInvalid(f);
    expect((document.activeElement as HTMLInputElement).value).toBe("transfer");
  });

  it("sin campos inválidos no mueve el foco", () => {
    const f = form(`<input name="fullName" /><button>Enviar</button>`);
    f.querySelector("button")!.focus();
    focusFirstInvalid(f);
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });
});
