// Content script for image manipulation
(function() {
  'use strict';
  
  let currentSettings = { mode: 'normal', scope: 'page' };
  let observer = null;
  let styleElement = null;
  
  // Initialize the content script
  function init() {
    loadAndApplySettings();
    setupMessageListener();
    setupMutationObserver();
  }
  
  // Load settings and apply them
  async function loadAndApplySettings() {
    try {
      const url = window.location.href;
      const domain = window.location.hostname;
      
      // Check settings in priority order: page -> domain -> global
      const pageKey = `page_${url}`;
      const domainKey = `domain_${domain}`;
      const globalKey = 'global';
      
      const result = await chrome.storage.local.get([pageKey, domainKey, globalKey]);
      
      const settings = result[pageKey] || result[domainKey] || result[globalKey] || {
        mode: 'normal',
        scope: 'page'
      };
      
      currentSettings = settings;
      applyImageSettings(settings.mode);
      
    } catch (error) {
      console.error('ImageShader: Failed to load settings:', error);
    }
  }
  
  // Listen for messages from popup or background script
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'applyImageSettings') {
        currentSettings = message.settings;
        applyImageSettings(message.settings.mode);
        sendResponse({ success: true });
      }
      return true;
    });
  }
  
  // Setup mutation observer to handle dynamically added images
  function setupMutationObserver() {
    if (observer) {
      observer.disconnect();
    }
    
    observer = new MutationObserver((mutations) => {
      if (currentSettings.mode !== 'normal') {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processNewImages(node);
            }
          });
        });
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Process newly added images
  function processNewImages(element) {
    // Handle img elements
    if (element.tagName === 'IMG') {
      applyImageMode(element, currentSettings.mode);
    }
    
    // Handle elements with background images
    const elementsWithBg = element.querySelectorAll ? 
      [element, ...element.querySelectorAll('*')] : [element];
    
    elementsWithBg.forEach(el => {
      if (hasBackgroundImage(el)) {
        applyBackgroundImageMode(el, currentSettings.mode);
      }
    });
  }
  
  // Apply image settings based on mode
  function applyImageSettings(mode) {
    removeExistingStyles();
    
    switch (mode) {
      case 'blocked':
        applyBlockedMode();
        break;
      case 'thumbnail':
        applyThumbnailMode();
        break;
      case 'normal':
      default:
        applyNormalMode();
        break;
    }
  }
  
  // Remove existing custom styles
  function removeExistingStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }
    
    // Remove inline styles we may have added
    document.querySelectorAll('img[data-image-shader]').forEach(img => {
      img.removeAttribute('data-image-shader');
      img.style.removeProperty('display');
      img.style.removeProperty('max-width');
      img.style.removeProperty('max-height');
      img.style.removeProperty('width');
      img.style.removeProperty('height');
      img.style.removeProperty('object-fit');
    });
    
    document.querySelectorAll('[data-bg-image-shader]').forEach(el => {
      el.removeAttribute('data-bg-image-shader');
      el.style.removeProperty('background-image');
      el.style.removeProperty('background-size');
    });
  }
  
  // Apply blocked mode - hide all images
  function applyBlockedMode() {
    const css = `
      img[data-image-shader="blocked"] {
        display: none !important;
      }
      [data-bg-image-shader="blocked"] {
        background-image: none !important;
      }
    `;
    
    injectCSS(css);
    
    // Process existing images
    document.querySelectorAll('img').forEach(img => {
      applyImageMode(img, 'blocked');
    });
    
    // Process elements with background images
    document.querySelectorAll('*').forEach(el => {
      if (hasBackgroundImage(el)) {
        applyBackgroundImageMode(el, 'blocked');
      }
    });
  }
  
  // Apply thumbnail mode - resize all images to 128x128
  function applyThumbnailMode() {
    const css = `
      img[data-image-shader="thumbnail"] {
        max-width: 128px !important;
        max-height: 128px !important;
        width: auto !important;
        height: auto !important;
        object-fit: cover !important;
      }
      [data-bg-image-shader="thumbnail"] {
        background-size: 128px 128px !important;
        width: 128px !important;
        height: 128px !important;
        background-repeat: no-repeat !important;
      }
    `;
    
    injectCSS(css);
    
    // Process existing images
    document.querySelectorAll('img').forEach(img => {
      applyImageMode(img, 'thumbnail');
    });
    
    // Process elements with background images
    document.querySelectorAll('*').forEach(el => {
      if (hasBackgroundImage(el)) {
        applyBackgroundImageMode(el, 'thumbnail');
      }
    });
  }
  
  // Apply normal mode - restore original behavior
  function applyNormalMode() {
    // Just remove all custom styles, which we already did in removeExistingStyles
  }
  
  // Apply mode to individual image element
  function applyImageMode(img, mode) {
    if (mode === 'normal') {
      img.removeAttribute('data-image-shader');
    } else {
      img.setAttribute('data-image-shader', mode);
    }
  }
  
  // Apply mode to element with background image
  function applyBackgroundImageMode(element, mode) {
    if (mode === 'normal') {
      element.removeAttribute('data-bg-image-shader');
    } else {
      element.setAttribute('data-bg-image-shader', mode);
    }
  }
  
  // Check if element has background image
  function hasBackgroundImage(element) {
    const style = window.getComputedStyle(element);
    const bgImage = style.backgroundImage;
    return bgImage && bgImage !== 'none' && bgImage.includes('url');
  }
  
  // Inject CSS into the page
  function injectCSS(css) {
    styleElement = document.createElement('style');
    styleElement.textContent = css;
    styleElement.setAttribute('data-image-shader-styles', 'true');
    document.head.appendChild(styleElement);
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Also initialize immediately in case we're injected after DOMContentLoaded
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(init, 0);
  }
  
})();