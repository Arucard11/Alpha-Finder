const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController.js');

router.post('/whitelist', adminController.addWhitelist);

module.exports = router;