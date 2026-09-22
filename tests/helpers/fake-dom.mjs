// Just enough of the DOM for the UI helpers that build elements without a
// page: createElement(NS), classes and attributes, children, and the few
// selectors those helpers use (".name", ":scope > .name", "[attribute]").

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  get names() {
    return (this.element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
  }

  set names(list) {
    this.element.setAttribute("class", [...new Set(list)].join(" "));
  }

  add(...names) {
    this.names = [...this.names, ...names];
  }

  remove(...names) {
    this.names = this.names.filter((name) => !names.includes(name));
  }

  toggle(name, force) {
    const on = force ?? !this.contains(name);
    if (on) this.add(name);
    else this.remove(name);
    return on;
  }

  contains(name) {
    return this.names.includes(name);
  }
}

export class FakeElement {
  constructor(tagName, namespaceURI = "http://www.w3.org/1999/xhtml") {
    this.tagName = tagName.toUpperCase();
    this.namespaceURI = namespaceURI;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.text = "";
    this.disabled = false;
    this.classList = new FakeClassList(this);
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

  set className(value) {
    this.setAttribute("class", value);
  }

  get textContent() {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.text = String(value);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  append(...nodes) {
    for (const node of nodes) {
      node.remove();
      node.parentNode = this;
      this.children.push(node);
    }
  }

  prepend(...nodes) {
    for (const node of [...nodes].reverse()) {
      node.remove();
      node.parentNode = this;
      this.children.unshift(node);
    }
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  *descendants() {
    for (const child of this.children) {
      yield child;
      yield* child.descendants();
    }
  }

  matches(simple) {
    if (simple.startsWith(".")) return this.classList.contains(simple.slice(1));
    const attribute = /^\[([\w-]+)\]$/.exec(simple);
    if (attribute) return this.hasAttribute(attribute[1]);
    return this.tagName === simple.toUpperCase();
  }

  querySelectorAll(selector) {
    const scoped = /^:scope\s*>\s*(.+)$/.exec(selector);
    if (scoped) return this.children.filter((child) => child.matches(scoped[1].trim()));
    return [...this.descendants()].filter((element) => element.matches(selector.trim()));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export function createFakeDocument() {
  const body = new FakeElement("body");
  return {
    body,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (namespace, tag) => new FakeElement(tag, namespace),
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    querySelector: (selector) => body.querySelector(selector)
  };
}
