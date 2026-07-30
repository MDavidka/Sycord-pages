#!/bin/bash
# Fix pnpm lockfile by regenerating it
rm -f pnpm-lock.yaml
pnpm install --no-frozen-lockfile
