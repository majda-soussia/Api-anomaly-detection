const express = require('express');
const router = express.Router();
const controller = require('../controllers/servers.controller');

router.get('/', controller.listServers);
router.post('/', controller.createServer);
router.delete('/:id', controller.deactivateServer);

module.exports = router;