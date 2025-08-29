# Image Shader Chrome Extension

A Chrome extension that allows you to control how images are displayed on web pages.

## Features

- **Block all images**: Hide all images on web pages
- **Thumbnail mode**: Resize all images to 128x128 pixels
- **Normal mode**: Default browser behavior

## Scope Options

- **Current page only**: Apply settings to the current page
- **Current domain**: Apply settings to all pages on the current domain
- **All websites**: Apply settings globally to all websites

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this extension folder
4. The Image Shader icon will appear in your extensions toolbar

## Usage

1. Click the Image Shader icon in your toolbar
2. Select your preferred image display mode
3. Choose the scope (page, domain, or global)
4. Click "Apply Settings"

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html` - Popup interface HTML
- `popup.js` - Popup functionality and UI logic
- `content.js` - Content script for image manipulation
- `background.js` - Background service worker for settings management

## How It Works

The extension uses Chrome's content scripts to inject CSS and JavaScript that modifies how images are displayed. Settings are stored using Chrome's storage API and can be scoped to pages, domains, or globally.