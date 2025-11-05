// This script will run before page renders and set the correct theme
// to prevent flash of wrong theme

export function getThemeScript(): string {
  return `
    (function() {
      try {
        let theme = localStorage.getItem('theme');

        // If no theme is saved, check system preference
        if (!theme) {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          localStorage.setItem('theme', theme);
        }

        console.log('[Theme Script] Theme from localStorage:', theme);

        // Remove any existing theme classes
        document.documentElement.classList.remove('light', 'dark');

        // Apply theme directly to HTML and BODY elements
        if (theme === 'dark') {
          // Add dark class to html element
          document.documentElement.classList.add('dark');

          // Set dark mode styles directly
          document.documentElement.style.backgroundColor = '#0f172a';
          document.documentElement.style.color = '#f1f5f9';

          // Also set on body - sometimes needed for certain CSS frameworks
          document.body.style.backgroundColor = '#0f172a';
          document.body.style.color = '#f1f5f9';

          console.log('[Theme Script] Applied dark theme');
        } else {
          // Add light class to html element
          document.documentElement.classList.add('light');

          // Set light mode styles directly
          document.documentElement.style.backgroundColor = '#ffffff';
          document.documentElement.style.color = '#171717';

          // Also set on body - sometimes needed for certain CSS frameworks
          document.body.style.backgroundColor = '#ffffff';
          document.body.style.color = '#171717';

          console.log('[Theme Script] Applied light theme');
        }
      } catch (e) {
        // Fall back to light theme if localStorage is unavailable
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        console.error('[Theme Script] Error:', e);
      }
    })();
  `;
}