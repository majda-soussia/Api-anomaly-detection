const { z } = require('zod');

const listPredictionsQuerySchema = z.object({
  decision: z.enum(['NORMAL', 'WARNING', 'CRITICAL']).optional(),
  server_id: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(['created_at', 'decision', 'confidence', 'server_id']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

module.exports = { listPredictionsQuerySchema };