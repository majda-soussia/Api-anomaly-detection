const predictionsService = require('../services/predictions.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');

const getPredictions = asyncHandler(async (req, res) => {
  const { decision, server_id: serverId, from, to, sort, order, limit, offset } = req.query;

  const result = await predictionsService.getPredictions({ decision, serverId, from, to, sort, order, limit, offset });

  return ok(res, result.predictions, { total: result.total, limit, offset, sort, order });
});

const getBreakdown = asyncHandler(async (req, res) => {
  const { server_id: serverId, from, to } = req.query;
  const breakdown = await predictionsService.getDecisionBreakdown({ serverId, from, to });
  return ok(res, breakdown);
});

module.exports = { getPredictions, getBreakdown };