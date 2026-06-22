const healthService = require('../services/health.service');

async function getHealth(req, res) {
  const health = await healthService.getSystemHealth();
  const httpStatus = health.overall === 'critical' ? 503 : 200;
  res.status(httpStatus).json(health);
}

//module.exports = { getHealth };
module.exports = router;