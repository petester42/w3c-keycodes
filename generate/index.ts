import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import * as prettier from "prettier";
import * as fs from "fs";

enum KeyTypes {
  AlphanumericWritingSystemKeys = "AlphanumericWritingSystemKeys",
  AlphanumericFunctionalKeys = "AlphanumericFunctionalKeys",
  ControlPadKeys = "ControlPadKeys",
  ArrowPadKeys = "ArrowPadKeys",
  NumPadKeys = "NumPadKeys",
  FunctionKeys = "FunctionKeys",
  MediaKeys = "MediaKeys"
}

function toTableId(keyType: KeyTypes): string {
  switch (keyType) {
    case KeyTypes.AlphanumericWritingSystemKeys:
      return "table-key-code-alphanumeric-writing-system";
    case KeyTypes.AlphanumericFunctionalKeys:
      return "table-key-code-alphanumeric-functional-1";
    case KeyTypes.ControlPadKeys:
      return "table-key-code-controlpad";
    case KeyTypes.ArrowPadKeys:
      return "table-key-code-arrowpad";
    case KeyTypes.NumPadKeys:
      return "table-key-code-numpad";
    case KeyTypes.FunctionKeys:
      return "table-key-code-function";
    case KeyTypes.MediaKeys:
      return "table-key-code-media";
  }
}

function keyTypes(): KeyTypes[] {
  return [
    KeyTypes.AlphanumericWritingSystemKeys,
    KeyTypes.AlphanumericFunctionalKeys,
    KeyTypes.ControlPadKeys,
    KeyTypes.ArrowPadKeys,
    KeyTypes.NumPadKeys,
    KeyTypes.FunctionKeys,
    KeyTypes.MediaKeys
  ];
}

function extractKeyCodes(
  id: string,
  dom: JSDOM
): { code: string; description: string }[] {
  let alphanumericWritingKeys = dom.window.document.querySelector(
    `[id='${id}'`
  ) as HTMLTableElement;

  if (!alphanumericWritingKeys) {
    throw Error(`Could not find table with id ${id}`);
  }

  alphanumericWritingKeys.deleteTHead();

  let rows = alphanumericWritingKeys.rows;
  let codes = new Array<{ code: string; description: string }>();
  for (let i = 0; i < rows.length; ++i) {
    let cells = rows.item(i).cells;

    let keyCode = (cells.item(0).textContent || "").trim();
    let description = (cells.item(1).textContent || "")
      .replace(/[\n\r]+|[\s]{2,}/g, " ")
      .trim();

    let key = {
      code: keyCode.slice(1, keyCode.length - 1),
      description: description
    };

    codes.push(key);
  }

  return codes;
}

function generateKeyGetter(key: { code: string; description: string }): string {
  return `/** ${key.description} */
  static get ${key.code}(): string {
    return "${key.code}";
  }`;
}

function generateKeyTypeSection(type: KeyTypes, dom: JSDOM): string {
  let tableId = toTableId(type);
  let extractedKeyCodes = extractKeyCodes(tableId, dom);

  return `export class ${type.toString()} { 
    ${extractedKeyCodes.map(key => generateKeyGetter(key)).join("\n\n")}

    static values(): string[] {
      return [${extractedKeyCodes.map(key => `"${key.code}"`).join(",")}]
    }

    static contains(key: string): boolean {
      return this.values().includes(key);
    }
  }`;
}

fetch("https://www.w3.org/TR/uievents-code/")
  .then(res => res.text())
  .then(html => new JSDOM(html))
  .then(dom => {
    let functions = keyTypes()
      .map(element => {
        return generateKeyTypeSection(element, dom);
      })
      .join("\n\n");

    return `/** THIS FILE IS AUTOGENERATED **/

        ${functions}
    
      `;
  })
  .then(file => prettier.format(file))
  .then(formattedFile => fs.writeFileSync("./lib/keycodes.ts", formattedFile));