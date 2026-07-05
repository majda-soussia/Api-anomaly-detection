const { z } = require('zod');

const listAlertsQuerySchema = z.object({
  decision: z.enum(['CRITICAL', 'WARNING']).optional(),
  status: z.enum(['active', 'acknowledged']).optional(),
  server_id: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['created_at', 'decision', 'confidence', 'server_id']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().positive().max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const alertIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Alert id must be a positive integer'),
});

const acknowledgeBodySchema = z.object({
  // Optional today (no auth wired up yet) — once auth exists, make this
  // required and source it from req.user instead of the request body.
  acknowledged_by: z.string().min(1).max(100).optional(),
});

module.exports = { listAlertsQuerySchema, alertIdParamSchema, acknowledgeBodySchema };
