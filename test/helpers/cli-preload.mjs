// Loaded with `node --import` by the CLI and child-process tests: points fetch at the fixture server in FIXTURE_BASE (see web.js).
import process from 'node:process';
import {installFetch} from './web.js';

installFetch({base: process.env.FIXTURE_BASE});
