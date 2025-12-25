#!/bin/bash
# Run this script to create a portable archive of the Cursor rules
# Usage: bash portable-rules.tar.gz.sh

cd "$(dirname "$0")/.."

# Create archive excluding this script itself
tar -czvf cursor-compound-rules.tar.gz \
  --exclude='.cursor/portable-rules.tar.gz.sh' \
  .cursor/

echo ""
echo "✅ Created cursor-compound-rules.tar.gz"
echo ""
echo "To apply to another project:"
echo "  1. Copy cursor-compound-rules.tar.gz to the project root"
echo "  2. Run: tar -xzvf cursor-compound-rules.tar.gz"
echo "  3. Delete the archive: rm cursor-compound-rules.tar.gz"


