import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        roleId: number;
        roleName: string;
        name?: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-lms-platform-2026';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication token missing or invalid.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      roleId: number;
      roleName: string;
      name?: string;
    };

    // Verify user exists and is not deleted
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    });

    if (!user || user.is_deleted) {
      return res.status(401).json({ message: 'User account has been deleted or deactivated.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      name: user.name,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed. Invalid token.' });
  }
};

/**
 * Higher-order middleware to enforce permission-based authorization (RBAC).
 */
export const requirePermission = (permissionName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required.' });
      }

      // Query if user's role has the requested permission
      const hasPermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: req.user.roleId,
          permission: {
            name: permissionName,
            is_deleted: false,
          },
        },
      });

      if (!hasPermission) {
        return res.status(403).json({
          message: `Permission denied. Required privilege: "${permissionName}".`,
        });
      }

      next();
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      return res.status(500).json({ message: 'Error checking permissions.' });
    }
  };
};
