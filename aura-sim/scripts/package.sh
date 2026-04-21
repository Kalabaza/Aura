#!/usr/bin/env bash

# Package Aura Simulator for distribution
# This script creates a distributable ZIP file with the production build

set -e  # Exit on error

# Configuration
VERSION=$(node -p "require('../package.json').version")
PKG_NAME="aura-sim"
ZIP_FILE="${PKG_NAME}-v${VERSION}.zip"
BUILD_DIR="dist"

echo "========================================"
echo "Aura Simulator Packaging Script"
echo "========================================"
echo "Version: ${VERSION}"
echo "Output: ${ZIP_FILE}"
echo ""

# Check prerequisites
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required but not installed." >&2; exit 1; }

# Clean previous build
if [ -d "${BUILD_DIR}" ]; then
  echo "Cleaning previous build..."
  rm -rf "${BUILD_DIR}"
fi

if [ -f "${ZIP_FILE}" ]; then
  echo "Removing previous package..."
  rm -f "${ZIP_FILE}"
fi

# Install dependencies
echo "Installing dependencies..."
npm ci --omit=optional

# Build production assets
echo "Building production assets..."
npm run build

# Verify build output
if [ ! -d "${BUILD_DIR}" ] || [ -z "$(ls -A ${BUILD_DIR})" ]; then
  echo "Error: Build output is empty or missing!"
  exit 1
fi

echo "Build completed successfully."

# Create ZIP package
echo "Creating ZIP package..."
ZIP_INCLUDES="${BUILD_DIR}/ README.md"
if [ -f "LICENSE" ]; then
  ZIP_INCLUDES="${ZIP_INCLUDES} LICENSE"
fi
if [ -f "CONTRIBUTING.md" ]; then
  ZIP_INCLUDES="${ZIP_INCLUDES} CONTRIBUTING.md"
fi
zip -r "${ZIP_FILE}" ${ZIP_INCLUDES} > /dev/null

# Verify ZIP
if [ -f "${ZIP_FILE}" ]; then
  SIZE=$(du -h "${ZIP_FILE}" | cut -f1)
  echo "Package created: ${ZIP_FILE} (${SIZE})"
else
  echo "Error: ZIP file creation failed!"
  exit 1
fi

echo ""
echo "========================================"
echo "Packaging complete!"
echo "========================================"
echo ""
echo "To distribute:"
echo "  - Upload ${ZIP_FILE} to GitHub Releases"
echo "  - Users can download and extract to any directory"
echo "  - Then run: cd ${PKG_NAME} && npm install && npm start"
echo ""
echo "Alternative: Use Docker"
echo "  docker build -t ${PKG_NAME} ."
echo "  docker run -p 5173:5173 -v \$(pwd)/../aura:/app/aura ${PKG_NAME}"
echo ""
