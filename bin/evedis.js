#!/usr/bin/env node

const path = require('path');

// Forward arguments and launch the EVEDIS Host Server with auto-display enabled
process.env.AUTO_START_VDISPLAY = '1';
require(path.join(__dirname, '..', 'server', 'index.js'));
