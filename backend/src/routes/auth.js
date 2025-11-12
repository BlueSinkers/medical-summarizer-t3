import express from 'express';
import passport from 'passport';
import { body, validationResult } from 'express-validator';
import {
  googleAuth,
  googleCallback,
  register,
  login,
  getCurrentUser,
  logout,
  verifyEmail
} from '../controllers/authController.js';

const router = express.Router();

// Input validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

// Email/Password routes
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
  ],
  validate,
  login
);

// Email verification
router.get('/verify-email/:token', verifyEmail);

// User info route
router.get('/me', passport.authenticate('jwt', { session: false }), getCurrentUser);

// Logout route
router.post('/logout', passport.authenticate('jwt', { session: false }), logout);

export default router;
