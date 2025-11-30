#!/bin/bash

# Chrome Web Store Package Script
# Packages the extension for submission to Chrome Web Store

echo "📦 Packaging Tella to Webhook Extension v1.0.0 for Chrome Web Store..."

# Create package directory
mkdir -p store-package

# Copy core extension files
echo "📁 Copying extension files..."
cp manifest.json store-package/
cp popup.html store-package/
cp popup.js store-package/
cp content.js store-package/
cp background.js store-package/
cp styles.css store-package/

# Copy icons
echo "🖼️ Copying icons..."
mkdir -p store-package/icons
cp icons/*.png store-package/icons/

# Create ZIP file for Chrome Web Store submission
echo "🗜️ Creating ZIP package..."
cd store-package
zip -r "../tella-webhook-extension-v1.0.0.zip" . -x "*.DS_Store"
cd ..

# Clean up temporary directory
rm -rf store-package

echo "✅ Package created: tella-webhook-extension-v1.0.0.zip"
echo ""
echo "📋 Next steps:"
echo "1. Create screenshots of the extension in action"
echo "2. Go to Chrome Web Store Developer Console"
echo "3. Upload the ZIP file"
echo "4. Add store listing details from store-assets/STORE_DESCRIPTION.md"
echo "5. Submit for review"
echo ""
echo "🔗 Chrome Web Store Developer Console:"
echo "https://chrome.google.com/webstore/devconsole"