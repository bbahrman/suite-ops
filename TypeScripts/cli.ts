#!/usr/bin/env node
import { compile } from './compile';

// Entry point for CLI
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: suite-compile <path-to-file>');
  process.exit(1);
}

compile(args[0]);
