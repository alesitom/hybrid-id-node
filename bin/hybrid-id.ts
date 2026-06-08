#!/usr/bin/env node
import { Application } from '../src/cli.js';

process.exit(new Application().run(process.argv.slice(2)));
