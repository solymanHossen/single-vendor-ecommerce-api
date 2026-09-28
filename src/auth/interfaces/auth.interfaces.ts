import { type Role } from '@prisma/client';
import type { Permission } from '../../access/permissions';

export interface JwtAccessPayload {
  sub: number;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  isActive: boolean;
  /** Resolved on every request from the role and staff role. */
  permissions: Permission[];
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | null;
  accessToken: string;
}

export interface SafeUser {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
