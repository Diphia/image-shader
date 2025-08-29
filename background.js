// Background script (Service Worker) for Image Shader extension

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Image Shader extension installed');
    // Initialize default global settings
    chrome.storage.local.set({
      'global': {
        mode: 'normal',
        scope: 'global',
        timestamp: Date.now()
      }
    });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'applySettings':
      handleApplySettings(message, sender, sendResponse);
      break;
    case 'getSettings':
      handleGetSettings(message, sender, sendResponse);
      break;
    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true; // Keep message channel open for async response
});

// Handle applying settings from popup
async function handleApplySettings(message, sender, sendResponse) {
  try {
    const { settings, tabId, url, domain } = message;
    
    // Apply settings to the current tab
    await applySettingsToTab(tabId, settings);
    
    // If scope is domain or global, apply to all relevant tabs
    if (settings.scope === 'domain') {
      await applySettingsToTabsByDomain(domain, settings, tabId);
    } else if (settings.scope === 'global') {
      await applySettingsToAllTabs(settings, tabId);
    }
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to apply settings:', error);
    sendResponse({ error: error.message });
  }
}

// Handle getting settings for a specific context
async function handleGetSettings(message, sender, sendResponse) {
  try {
    const { url, domain } = message;
    const settings = await getSettingsForContext(url, domain);
    sendResponse({ settings });
  } catch (error) {
    console.error('Failed to get settings:', error);
    sendResponse({ error: error.message });
  }
}

// Apply settings to a specific tab
async function applySettingsToTab(tabId, settings) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'applyImageSettings',
      settings: settings
    });
  } catch (error) {
    // Tab might not have the content script injected yet, or might be a special page
    console.log(`Could not apply settings to tab ${tabId}:`, error.message);
  }
}

// Apply settings to all tabs in a domain
async function applySettingsToTabsByDomain(domain, settings, excludeTabId) {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.id !== excludeTabId && tab.url) {
        try {
          const tabUrl = new URL(tab.url);
          if (tabUrl.hostname === domain) {
            await applySettingsToTab(tab.id, settings);
          }
        } catch (e) {
          // Invalid URL or special page, skip
        }
      }
    }
  } catch (error) {
    console.error('Failed to apply settings to domain tabs:', error);
  }
}

// Apply settings to all tabs
async function applySettingsToAllTabs(settings, excludeTabId) {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.id !== excludeTabId && tab.url && !isSpecialPage(tab.url)) {
        await applySettingsToTab(tab.id, settings);
      }
    }
  } catch (error) {
    console.error('Failed to apply settings to all tabs:', error);
  }
}

// Get settings for a specific context (URL/domain)
async function getSettingsForContext(url, domain) {
  const pageKey = `page_${url}`;
  const domainKey = `domain_${domain}`;
  const globalKey = 'global';
  
  const result = await chrome.storage.local.get([pageKey, domainKey, globalKey]);
  
  return result[pageKey] || result[domainKey] || result[globalKey] || {
    mode: 'normal',
    scope: 'page'
  };
}

// Check if URL is a special page that we can't inject scripts into
function isSpecialPage(url) {
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') || 
         url.startsWith('moz-extension://') ||
         url.startsWith('about:') ||
         url.startsWith('file://');
}

// Handle tab updates to apply settings to newly loaded pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !isSpecialPage(tab.url)) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      const settings = await getSettingsForContext(tab.url, domain);
      
      // Only apply if settings are not normal mode
      if (settings.mode !== 'normal') {
        // Small delay to ensure content script is ready
        setTimeout(() => {
          applySettingsToTab(tabId, settings);
        }, 500);
      }
    } catch (error) {
      console.error('Failed to handle tab update:', error);
    }
  }
});

// Clean up old settings periodically (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldSettings();
  }
});

// Create cleanup alarm (runs daily)
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('cleanup', { delayInMinutes: 1440 }); // 24 hours
});

// Clean up settings older than 30 days for pages that haven't been visited
async function cleanupOldSettings() {
  try {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = [];
    
    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith('page_') && value.timestamp && value.timestamp < thirtyDaysAgo) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old page settings`);
    }
  } catch (error) {
    console.error('Failed to cleanup old settings:', error);
  }
}