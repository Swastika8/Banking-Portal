import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/auditService';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-lms-platform-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-lms-key-2026';
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

/**
 * Helper to generate JWT access & refresh tokens
 */
const generateTokens = (user: { id: number; email: string; roleId: number; role: { name: string } }) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, roleId: user.roleId, roleName: user.role.name },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRATION as any }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRATION as any }
  );

  return { accessToken, refreshToken };
};

export class AuthController {
  public static async register(req: Request, res: Response) {
    try {
      // Check if registration is enabled in system settings
      const regSetting = await prisma.systemSetting.findUnique({
        where: { key: 'enable_registration' },
      });

      if (!regSetting || regSetting.value !== 'true') {
        return res.status(403).json({ message: 'Registration has been disabled by administrator.' });
      }

      const { email, password, name, roleName } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ message: 'Email, password, and name are required.' });
      }

      // Default role to Staff if not specified or roleName not found
      const requestedRole = roleName || 'Staff';
      const role = await prisma.role.findFirst({
        where: { name: requestedRole, is_deleted: false },
      });

      if (!role) {
        return res.status(400).json({ message: `Role "${requestedRole}" does not exist.` });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });

      if (existingUser && !existingUser.is_deleted) {
        return res.status(400).json({ message: 'Email is already registered.' });
      }

      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              name,
              roleId: role.id,
              refreshToken: null,
              is_deleted: false,
              deleted_at: null,
              deleted_by: null,
              updated_by: 'SELF_REGISTER',
              created_by: existingUser.created_by || 'SELF_REGISTER',
            },
            include: { role: true },
          })
        : await prisma.user.create({
            data: {
              email,
              passwordHash,
              name,
              roleId: role.id,
              created_by: 'SELF_REGISTER',
            },
            include: { role: true },
          });

      // Audit Log
      await AuditService.logAction({
        userId: user.id,
        action: 'CREATE',
        module: 'AUTH',
        newValue: { email, name, role: role.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const { accessToken, refreshToken } = generateTokens(user);

      // Save refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return res.status(201).json({
        message: existingUser?.is_deleted ? 'Registration successful. Your deleted account was reactivated.' : 'Registration successful.',
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
      });
    } catch (error: any) {
      console.error('Register Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });

      if (!user || user.is_deleted) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const { accessToken, refreshToken } = generateTokens(user);

      // Save refresh token in DB
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      // Audit Log
      await AuditService.logAction({
        userId: user.id,
        action: 'LOGIN',
        module: 'AUTH',
        newValue: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
      });
    } catch (error: any) {
      console.error('Login Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required.' });
      }

      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: number; email: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { role: true },
      });

      if (!user || user.is_deleted || user.refreshToken !== refreshToken) {
        return res.status(401).json({ message: 'Invalid or expired refresh token.' });
      }

      const tokens = generateTokens(user);

      // Rotate refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });

      return res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }
  }

  public static async logout(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(400).json({ message: 'Missing token header.' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token) as { id: number };

      if (decoded && decoded.id) {
        await prisma.user.update({
          where: { id: decoded.id },
          data: { refreshToken: null },
        });

        // Audit Log
        await AuditService.logAction({
          userId: decoded.id,
          action: 'LOGOUT',
          module: 'AUTH',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      return res.json({ message: 'Logged out successfully.' });
    } catch (error) {
      return res.status(500).json({ message: 'Logout failed.' });
    }
  }

  public static async forgotPassword(req: Request, res: Response) {
    try {
      // 1. Check if forgot password setting is enabled
      const forgotSetting = await prisma.systemSetting.findUnique({
        where: { key: 'enable_forgot_password' },
      });

      if (!forgotSetting || forgotSetting.value !== 'true') {
        return res.status(403).json({ message: 'Password reset has been disabled by administrator.' });
      }

      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Return success even if email is missing to prevent user enumeration security issues
        return res.json({ message: 'If the email exists, a password reset instruction has been sent.' });
      }

      // Generate a mock reset token
      const resetToken = jwt.sign({ id: user.id, purpose: 'RESET' }, JWT_SECRET, { expiresIn: '1h' });

      // Log the reset trigger
      await AuditService.logAction({
        userId: user.id,
        action: 'UPDATE',
        module: 'AUTH',
        newValue: { action: 'Forgot Password Request Generated' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Write mock response or send email (Nodemailer config checked inside controller / router)
      const smtpSetting = await prisma.systemSetting.findUnique({
        where: { key: 'enable_smtp' },
      });

      const isSmtpEnabled = smtpSetting?.value === 'true';

      if (isSmtpEnabled) {
        // Mock email log - In production Nodemailer would be loaded with credentials
        console.log(`[SMTP] Sending password reset link to ${email}: http://localhost:5173/reset-password?token=${resetToken}`);
      }

      return res.json({
        message: 'Password reset instruction generated.',
        resetToken: isSmtpEnabled ? undefined : resetToken, // Expose token to frontend only if SMTP is disabled so user can test easily!
        note: isSmtpEnabled ? 'Check server logs for the SMTP output.' : 'SMTP is disabled; reset token returned directly for demo purposes.',
      });
    } catch (error) {
      console.error('Forgot Password Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; purpose: string };
      if (decoded.purpose !== 'RESET') {
        return res.status(400).json({ message: 'Invalid reset token purpose.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || user.is_deleted) {
        return res.status(400).json({ message: 'User does not exist.' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, refreshToken: null },
      });

      await AuditService.logAction({
        userId: user.id,
        action: 'UPDATE',
        module: 'AUTH',
        newValue: { action: 'Password reset via token success' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Password reset successfully.' });
    } catch (error) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }
  }

  public static async changePassword(req: Request, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new password are required.' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(400).json({ message: 'User not found.' });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Incorrect current password.' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, refreshToken: null },
      });

      await AuditService.logAction({
        userId: user.id,
        action: 'UPDATE',
        module: 'AUTH',
        newValue: { action: 'Password changed manually' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Password changed successfully.' });
    } catch (error) {
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
}
