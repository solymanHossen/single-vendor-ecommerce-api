/** Identifies whose cart is being operated on: an authenticated user or a guest session. */
export type CartIdentity = { type: 'user'; id: number } | { type: 'session'; id: string };
