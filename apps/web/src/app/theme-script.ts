// This script will run before page renders and set the correct theme
// to prevent flash of wrong theme. It executes in <head>, where document.body
// does NOT exist yet — so body styling is guarded (and applied on DOM ready as a
// fallback) to avoid a "Cannot read properties of null" error on every page.

export function getThemeScript(): string {
  return `
    (function() {
      try {
        var theme = localStorage.getItem('theme');
        if (!theme) {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          localStorage.setItem('theme', theme);
        }
        var bg = theme === 'dark' ? '#0f172a' : '#ffffff';
        var fg = theme === 'dark' ? '#f1f5f9' : '#171717';

        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme === 'dark' ? 'dark' : 'light');
        document.documentElement.style.backgroundColor = bg;
        document.documentElement.style.color = fg;

        // <head> runs before <body> exists — apply body styles only once it's available.
        var applyBody = function () {
          if (!document.body) return;
          document.body.style.backgroundColor = bg;
          document.body.style.color = fg;
        };
        if (document.body) applyBody();
        else document.addEventListener('DOMContentLoaded', applyBody, { once: true });
      } catch (e) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    })();
  `;
}
