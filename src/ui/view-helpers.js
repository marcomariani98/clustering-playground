"use strict";

// Low-level view helpers shared by src/ui/ modules: HTML entity escaping,
// attribute escaping, theme detection, and color conversion. These utilities
// prevent XSS injection and normalize DOM queries across UI components.

// Escape HTML special characters to prevent XSS when inserting text into the DOM.
// Converts &, <, > to their entity equivalents.
function escapeHtml(text){
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Escape attribute values to prevent XSS in HTML attributes. Also handles
// the double-quote character which terminates attribute values in HTML.
function escapeAttr(text){
    return String(text || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Check if dark theme is currently active by reading the dataset attribute
// on the root HTML element. Returns true for dark mode, false for light mode.
function isDarkTheme(){
    return document.documentElement.dataset.theme === "dark";
}

// Convert a hex color string (e.g. "#4f8cff") to an RGBA string with the
// given alpha (0.0 to 1.0). Used for gradients and theme-aware overlays.
function hexToRgba(hex, alpha){
    let raw = hex.replace("#", "");
    let r = parseInt(raw.slice(0, 2), 16);
    let g = parseInt(raw.slice(2, 4), 16);
    let b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
