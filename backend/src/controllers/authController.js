import passport from 'passport';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import crypto from 'crypto';
import { sendVerificationEmail } from '../utils/emailService.js';
import { generateToken } from '../config/auth.js';

// Google OAuth
const googleAuth = (req, res, next) => {
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })(req, res, next);
};

const googleCallback = (req, res, next) => {
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
    session: false 
  }, async (err, user, info) => {
    try {
      if (err) {
        console.error('Google OAuth error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
      }
      
      if (!user) {
        console.error('Google OAuth failed: No user returned');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }
      
      // Update last login time
      user.lastLogin = new Date();
      await user.save();
      
      // Generate token
      const token = generateToken(user);
      
      // Log successful login
      console.log('Google OAuth successful for user:', user.email);
      
      // Redirect with token and user data
      const userData = encodeURIComponent(JSON.stringify({
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        picture: user.picture || ''
      }));
      
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?` +
        `token=${token}` +
        `&user=${userData}`
      );
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  })(req, res, next);
};

// Email/Password Authentication
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already in use' 
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      name,
      isVerified: false,
      verificationToken: crypto.randomBytes(20).toString('hex'),
      lastLogin: new Date()
    });

    try {
      await user.save();
      console.log('User saved to MongoDB:', { id: user._id, email: user.email });
      
      // Send verification email (in production)
      if (process.env.NODE_ENV === 'production') {
        await sendVerificationEmail(user);
      }

      // Generate token
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        message: process.env.NODE_ENV === 'production' 
          ? 'Registration successful. Please check your email to verify your account.'
          : 'Registration successful. Account created.',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          isVerified: user.isVerified,
          picture: user.picture || ''
        }
      });
    } catch (error) {
      console.error('Error saving user to MongoDB:', error);
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Generate token
    const token = generateToken(user);

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        picture: user.picture || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error logging in',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

const getCurrentUser = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({
    id: req.user._id,
    email: req.user.email,
    name: req.user.name,
    isVerified: req.user.isVerified,
    picture: req.user.picture
  });
};

const logout = (req, res) => {
  try {
    // Clear the token from client-side cookies
    res.clearCookie('token');
    res.clearCookie('connect.sid');
    
    // For JWT, we can't invalidate the token on the server side
    // without maintaining a token blacklist or using refresh tokens
    // For now, we'll just clear the client-side token and let it expire
    
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ success: false, message: 'Error during logout' });
      }
      
      // Clear the session cookie
      res.clearCookie('connect.sid', { path: '/' });
      
      // Send success response
      res.json({ 
        success: true, 
        message: 'Successfully logged out' 
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error during logout',
      error: error.message 
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Error verifying email', error: error.message });
  }
};

export {
  googleAuth,
  googleCallback,
  register,
  login,
  getCurrentUser,
  logout,
  verifyEmail
};
