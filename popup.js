// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  await loadCurrentSettings();
  setupEventListeners();
});

// Load current settings from storage
async function loadCurrentSettings() {
  try {
    const tab = await getCurrentTab();
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    // Check settings in priority order: page -> domain -> global
    const pageKey = `page_${tab.url}`;
    const domainKey = `domain_${domain}`;
    const globalKey = 'global';
    
    const result = await chrome.storage.local.get([pageKey, domainKey, globalKey]);
    
    let settings = result[pageKey] || result[domainKey] || result[globalKey] || {
      mode: 'normal',
      scope: 'page'
    };
    
    // Update UI with loaded settings
    document.querySelector(`input[name="imageMode"][value="${settings.mode}"]`).checked = true;
    document.querySelector(`input[name="scope"][value="${settings.scope}"]`).checked = true;
    
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('applySettings').addEventListener('click', applySettings);
}

// Get current active tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Apply settings based on user selection
async function applySettings() {
  try {
    const imageMode = document.querySelector('input[name="imageMode"]:checked').value;
    const scope = document.querySelector('input[name="scope"]:checked').value;
    
    const tab = await getCurrentTab();
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    const settings = {
      mode: imageMode,
      scope: scope,
      timestamp: Date.now()
    };
    
    // Store settings based on scope
    let storageKey;
    switch (scope) {
      case 'page':
        storageKey = `page_${tab.url}`;
        break;
      case 'domain':
        storageKey = `domain_${domain}`;
        // Clear any existing page-specific settings for this domain
        await clearPageSettingsForDomain(domain);
        break;
      case 'global':
        storageKey = 'global';
        // Clear all domain and page specific settings
        await clearAllSpecificSettings();
        break;
    }
    
    await chrome.storage.local.set({ [storageKey]: settings });
    
    // Send message to background script to apply changes
    await chrome.runtime.sendMessage({
      action: 'applySettings',
      settings: settings,
      tabId: tab.id,
      url: tab.url,
      domain: domain
    });
    
    // Show success message
    showStatus('Settings applied successfully!', 'success');
    
    // Auto-close popup after short delay
    setTimeout(() => {
      window.close();
    }, 1000);
    
  } catch (error) {
    console.error('Failed to apply settings:', error);
    showStatus('Failed to apply settings', 'error');
  }
}

// Clear page-specific settings for a domain
async function clearPageSettingsForDomain(domain) {
  const allData = await chrome.storage.local.get(null);
  const keysToRemove = [];
  
  for (const key in allData) {
    if (key.startsWith('page_')) {
      const pageUrl = key.substring(5); // Remove 'page_' prefix
      try {
        const url = new URL(pageUrl);
        if (url.hostname === domain) {
          keysToRemove.push(key);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

// Clear all specific settings (domain and page)
async function clearAllSpecificSettings() {
  const allData = await chrome.storage.local.get(null);
  const keysToRemove = [];
  
  for (const key in allData) {
    if (key.startsWith('page_') || key.startsWith('domain_')) {
      keysToRemove.push(key);
    }
  }
  
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
}