import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "li",
      "ol",
      "p",
      "pre",
      "span",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "u",
      "ul"
    ],
    ALLOWED_ATTR: ["href", "title", "target", "rel"],
    FORBID_TAGS: ["form", "iframe", "object", "script", "style"],
    ADD_ATTR: ["rel"],
    RETURN_TRUSTED_TYPE: false
  });
}

export function normalizeEmailText(value: string, maxLength: number): string {
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}
