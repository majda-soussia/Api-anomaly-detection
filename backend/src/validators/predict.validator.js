const { z } = require('zod');

const predictBodySchema = z
  .object({
    server_id: z.string().min(1, 'server_id is required'),
  })
  .catchall(z.number().finite('All feature values must be finite numbers'))
  .refine((obj) => Object.keys(obj).length > 1, {
    message: 'At least one feature value is required in addition to server_id',
  });

module.exports = { predictBodySchema };
