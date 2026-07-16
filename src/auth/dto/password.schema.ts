import { z } from 'zod';

/** Shared strength policy for any password a user submits directly (registration, reset). */
export const PasswordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'password must contain at least one lowercase letter, one uppercase letter, and one digit',
  );
