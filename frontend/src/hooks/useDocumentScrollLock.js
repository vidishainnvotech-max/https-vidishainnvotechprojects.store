import { useEffect } from "react";

const LOCK_TARGET_SELECTORS = [
  "#root",
  ".app",
  ".app-content",
  ".admin-shell",
  ".admin-shell__main",
  ".admin-shell__content",
  ".student-page",
  ".student-page > main",
];

const STYLE_PROPERTIES = [
  "overflow",
  "overflow-x",
  "overflow-y",
  "overscroll-behavior",
  "overscroll-behavior-x",
  "overscroll-behavior-y",
];

let lockCount = 0;
let lockedElements = new Map();
let wheelListenerAttached = false;

function uniqueElements(items) {
  return [...new Set(items.filter(Boolean))];
}

function getLockTargets() {
  const selectorTargets = LOCK_TARGET_SELECTORS.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)),
  );

  return uniqueElements([
    document.documentElement,
    document.body,
    document.scrollingElement,
    ...selectorTargets,
  ]);
}

function saveInlineStyles(element) {
  return STYLE_PROPERTIES.reduce((styles, property) => {
    styles[property] = {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    };
    return styles;
  }, {});
}

function restoreInlineStyles(element, styles) {
  STYLE_PROPERTIES.forEach((property) => {
    const saved = styles[property];
    if (saved.value) {
      element.style.setProperty(property, saved.value, saved.priority);
    } else {
      element.style.removeProperty(property);
    }
  });
}

function isAllowedOverlayScroll(target) {
  return target instanceof Element && Boolean(target.closest("[data-scroll-lock-allow]"));
}

function preventBackgroundScroll(event) {
  if (!isAllowedOverlayScroll(event.target)) {
    event.preventDefault();
  }
}

function attachScrollGuards() {
  if (wheelListenerAttached) return;
  document.addEventListener("wheel", preventBackgroundScroll, {
    capture: true,
    passive: false,
  });
  document.addEventListener("touchmove", preventBackgroundScroll, {
    capture: true,
    passive: false,
  });
  wheelListenerAttached = true;
}

function removeScrollGuards() {
  if (!wheelListenerAttached) return;
  document.removeEventListener("wheel", preventBackgroundScroll, true);
  document.removeEventListener("touchmove", preventBackgroundScroll, true);
  wheelListenerAttached = false;
}

function lockDocumentScroll() {
  lockCount += 1;
  if (lockCount > 1) return;

  document.documentElement.classList.add("lenis-stopped");

  lockedElements = new Map();
  getLockTargets().forEach((element) => {
    lockedElements.set(element, saveInlineStyles(element));
    element.style.setProperty("overflow", "hidden", "important");
    element.style.setProperty("overflow-x", "hidden", "important");
    element.style.setProperty("overflow-y", "hidden", "important");
    element.style.setProperty("overscroll-behavior", "none", "important");
  });

  document.documentElement.classList.add("document-scroll-locked");
  attachScrollGuards();
}

function unlockDocumentScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  document.documentElement.classList.remove("lenis-stopped");

  lockedElements.forEach((styles, element) => restoreInlineStyles(element, styles));
  lockedElements.clear();
  document.documentElement.classList.remove("document-scroll-locked");
  removeScrollGuards();
}

export default function useDocumentScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    lockDocumentScroll();
    return unlockDocumentScroll;
  }, [locked]);
}

