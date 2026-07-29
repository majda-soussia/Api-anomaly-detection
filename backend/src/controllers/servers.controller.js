const asyncHandler = require('../utils/asyncHandler');
const serversService = require('../services/servers.service');

const listServers = asyncHandler(async (req, res) => {
  const servers = await serversService.listServers();
  res.json({ success: true, data: servers });
});

const createServer = asyncHandler(async (req, res) => {
  const { name, environment } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Le nom du serveur est requis' });
  }

  const server = await serversService.createServer({
    name: name.trim(),
    environment: environment && environment.trim() ? environment.trim() : 'production',
  });

  res.status(201).json({ success: true, data: server });
});

const deactivateServer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const server = await serversService.deactivateServer(id);

  if (!server) {
    return res.status(404).json({ success: false, message: 'Serveur introuvable' });
  }

  res.json({ success: true, data: server });
});

module.exports = { listServers, createServer, deactivateServer };