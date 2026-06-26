const http = require('http');
const app = require('./app');
const { initSocket } = require('./websocket/socket');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

// On crée un serveur HTTP "brut" à partir d'Express,
// car Socket.IO doit s'attacher au même serveur HTTP qu'Express
const httpServer = http.createServer(app);

// Initialisation de Socket.IO sur ce même serveur
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Serveur Node.js démarré sur le port ${PORT}`);
});