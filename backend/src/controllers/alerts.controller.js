const alertsService = require('../services/alerts.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/apiResponse');

const getAlerts = asyncHandler(async (req, res) => {
  const { decision, status, server_id: serverId, from, to, sort, order, limit, offset } = req.query;

  const result = await alertsService.getAlerts({ decision, status, serverId, from, to, sort, order, limit, offset });

  return ok(res, result.alerts, { total: result.total, limit, offset, sort, order });
});

const acknowledgeAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { acknowledged_by: acknowledgedBy } = req.body;

  const alert = await alertsService.acknowledgeAlert(id, acknowledgedBy);

  if (!alert) {
    const existing = await alertsService.getAlertById(id);
    if (!existing) {
      throw AppError.notFound(`Alert ${id} not found.`, 'ALERT_NOT_FOUND');
    }
    throw AppError.conflict(`Alert ${id} already acknowledged.`, 'ALERT_ALREADY_ACKNOWLEDGED');
  }

  return ok(res, alert, { message: `Alert ${id} acknowledged.` });
});

const getMttr = asyncHandler(async (req, res) => {
  const { server_id: serverId, from, to } = req.query;
  const mttrSeconds = await alertsService.getMttrSeconds({ serverId, from, to });
  return ok(res, { mttrSeconds });
});

module.exports = { getAlerts, acknowledgeAlert, getMttr };
