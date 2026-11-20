import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function addRequiredMarkers(root = document) {
  root.querySelectorAll("label").forEach((label) => {
    if (label.querySelector(":scope > .required-mark[data-auto-required]")) return;

    const control = label.querySelector("input[required], select[required], textarea[required]");
    if (!control) return;

    control.setAttribute("aria-required", "true");

    let anchor = control;
    while (anchor.parentElement && anchor.parentElement !== label) {
      anchor = anchor.parentElement;
    }

    const marker = document.createElement("span");
    marker.className = "required-mark";
    marker.dataset.autoRequired = "true";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "*";
    label.insertBefore(marker, anchor);
  });
}

function RequiredFieldMarkers() {
  const { pathname } = useLocation();

  useEffect(() => {
    addRequiredMarkers();

    const observer = new MutationObserver(() => addRequiredMarkers());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

export default RequiredFieldMarkers;
