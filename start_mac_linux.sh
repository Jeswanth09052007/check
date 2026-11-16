#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -d back-end/node_modules ] || [ ! -d frontend/node_modules ]; then npm run setup; fi
npm run dev
