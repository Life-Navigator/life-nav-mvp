/**
 * This script forcefully applies dark mode styles directly to the DOM
 * It should be included with a script tag in the HTML head
 */

// Execute immediately
(function() {
  try {
    // Get theme preference from localStorage
    const theme = localStorage.getItem('theme');
    
    // If dark mode is saved in localStorage
    if (theme === 'dark') {
      // Add dark class to both html and body elements (for compatibility)
      document.documentElement.classList.add('dark');
      
      // Schedule body class update for when body is available
      const applyBodyClass = function() {
        if (document.body) {
          document.body.classList.add('dark-mode');
          
          // Apply explicit dark mode styles to body
          document.body.style.backgroundColor = '#0f172a';
          document.body.style.color = '#f1f5f9';
        } else {
          // If body isn't available yet, try again in 5ms
          setTimeout(applyBodyClass, 5);
        }
      };
      
      // Start the process
      applyBodyClass();
      
      // Log that dark mode was applied
      console.log('[Force Dark Mode] Applied dark mode styles');
    }
  } catch (e) {
    console.error('[Force Dark Mode] Error:', e);
  }
})();