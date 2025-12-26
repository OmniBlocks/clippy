import * as z from "zod";

export const scratchSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9]+$/, 'must only contain letters and numbers'),
  name: z.string(),
  blockData: z.strictObject({
    globalExtensions: z.array(z.string()).optional(),
    colors: z.array(z.string().regex(/#[a-f0-9]{3}([a-f0-9]{3})?/i, 'Invalid color')).check(z.maxLength(3, 'Too many colors')).optional()
  }).optional(),
  galleryData: z.object({
    name: z.string().optional(),
    description: z.string(),
    authors: z.array(z.string()).optional(),
    license: z.string(),
    tags: z.array(z.string()).optional()
  }).optional(),
  expose: z.boolean().optional().default(false),
  docsURI: z.url().optional(),
  esbuildConfig: z.object().optional()
})