/**
 * middleware/validate.js
 * -------------------------
 * BEFORE: validation was done by hand inside controllers with manual
 * `if (...) return res.status(400)...` checks (alerts.controller.js did
 * this for `decision`/`status`; predict.controller.js only checked the body
 * wasn't empty, then let FastAPI's Pydantic models do the real validation
 * over the network — meaning a malformed request pays the cost of a full
 * HTTP round trip before being rejected).
 *
 * AFTER: schema-driven validation at the edge, before any business logic or
 * network calls run. Validated/coerced values replace the raw input so
 * downstream code can trust their types.
 */

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error); // handled centrally by errorHandler (ZodError branch)
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
