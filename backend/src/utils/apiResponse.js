function ok(res, data, meta, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function fail(res, statusCode, message, code = 'ERROR') {
  return res.status(statusCode).json({ success: false, error: { message, code } });
}

module.exports = { ok, fail };
