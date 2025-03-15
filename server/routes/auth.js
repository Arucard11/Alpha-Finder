const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js');

router.get('/checkWhitelist/:address', authController.getWhitelist);

module.exports = router;