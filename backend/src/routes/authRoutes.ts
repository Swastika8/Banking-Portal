import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { sendOTPEmail, generateOTP } from '../lib/mailer';
import { otpStore } from '../lib/otpStore';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh', AuthController.refresh);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
//POST /auth/send-otp
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const otp = generateOTP();
  otpStore.set(email, otp);

  try {
    await sendOTPEmail(email, otp);
    res.json({ message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
  });

// Secured Route
router.post('/change-password', authMiddleware, AuthController.changePassword);

// POST /auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const result = otpStore.verify(email, otp);

  if (result === 'expired') return res.status(400).json({ error: 'OTP expired, request a new one.' });
  if (result === 'invalid') return res.status(400).json({ error: 'Invalid OTP.' });

  const resetToken = jwt.sign(
    { email, purpose: 'RESET' },
    process.env.JWT_SECRET || 'super-secret-jwt-key-for-lms-platform-2026',
    { expiresIn: '10m' }
  );

  return res.json({ success: true, resetToken });
});

export default router;
