#!/usr/bin/env node

const path = require('path');

// Launch the EVEDIS Host Server (Virtual display remains in standby until activated via website)
require(path.join(__dirname, '..', 'server', 'index.js'));
