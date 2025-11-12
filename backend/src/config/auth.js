import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Configure Passport with JWT strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-jwt-secret'
};

// JWT Strategy for protected routes
passport.use(new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
  try {
    const user = await User.findById(jwtPayload.id);
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
}));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  scope: ['profile', 'email'],
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    if (!profile || !profile.emails || !profile.emails[0] || !profile.emails[0].value) {
      console.error('Invalid profile data from Google:', profile);
      return done(new Error('Invalid profile data from Google'), null);
    }

    const email = profile.emails[0].value;
    
    // Check if user exists by googleId or email
    let user = await User.findOne({
      $or: [
        { googleId: profile.id },
        { email: email.toLowerCase() }
      ]
    });
    
    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        googleId: profile.id,
        email: email.toLowerCase(),
        name: profile.displayName || email.split('@')[0],
        picture: profile.photos?.[0]?.value.replace(/=s\d+(-c)?$/, '=s400') || '',
        isVerified: true // Google-verified emails are considered verified
      });
      await user.save();
      console.log('New user created via Google OAuth:', user.email);
    } else if (!user.googleId) {
      // If user exists but doesn't have googleId, update it
      user.googleId = profile.id;
      user.picture = user.picture || profile.photos?.[0]?.value.replace(/=s\d+(-c)?$/, '=s400') || '';
      user.isVerified = true; // Mark as verified if logging in with Google
      await user.save();
      console.log('Existing user linked with Google OAuth:', user.email);
    }
    
    return done(null, user);
  } catch (error) {
    console.error('Error in Google OAuth strategy:', error);
    return done(error, null);
  }
}));

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const configurePassport = (app) => {
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/medisum',
      collectionName: 'sessions'
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  }));

  // Initialize Passport and restore authentication state from session
  app.use(passport.initialize());
  app.use(passport.session());

  // Initialize routes
  app.get('/api/auth/google', (req, res, next) => {
    // Store any redirect URL from the request
    const { redirect } = req.query;
    if (redirect) {
      req.session.redirect = redirect;
    }
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'select_account', // Force account selection
      accessType: 'offline' // Request refresh token
    })(req, res, next);
  });

  app.get('/api/auth/google/callback',
    (req, res, next) => {
      passport.authenticate('google', {
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
        session: false
      }, (err, user, info) => {
        if (err) {
          console.error('Google OAuth error:', err);
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
        
        if (!user) {
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }
        
        try {
          // Generate JWT token
          const token = generateToken(user);
          
          // Prepare user data for frontend
          const userData = encodeURIComponent(JSON.stringify({
            id: user._id,
            email: user.email,
            name: user.name,
            isVerified: user.isVerified,
            picture: user.picture || ''
          }));
          
          // Redirect to frontend with token and user data
          const redirectUrl = req.session.redirect 
            ? `${process.env.FRONTEND_URL}${req.session.redirect}?token=${token}&user=${userData}`
            : `${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${userData}`;
            
          // Clear the redirect URL from session
          delete req.session.redirect;
          
          res.redirect(redirectUrl);
        } catch (error) {
          console.error('Error in OAuth callback:', error);
          res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
      })(req, res, next);
    }
  );

  // Logout route
  app.get('/api/auth/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.user = user;
    return next();
  })(req, res, next);
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || 'your-jwt-secret',
    { expiresIn: '7d' }
  );
};

export { configurePassport, isAuthenticated, generateToken };
