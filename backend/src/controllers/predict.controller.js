const predictService = require('../services/predict.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');

const predict = asyncHandler(async (req, res) => {
  const features = req.body;
  const result = await predictService.predict(features);

  const message = result.alert
    ? `Alert ${result.prediction.decision} created (id: ${result.alert.id})`
    : result.cooldown
      ? 'Alert suppressed (cooldown active for this server)'
      : 'No anomaly detected';

  return ok(res, {
    prediction: result.prediction,
    alert: result.alert || null,
    cooldown: result.cooldown || false,
    message,
  });
});

module.exports = { predict };
