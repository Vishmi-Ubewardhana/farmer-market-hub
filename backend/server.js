const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Load env vars
dotenv.config();

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');

const app = express();

// Serve uploads before helmet — Expo/React dev server is on another origin (:808x vs API port).
// Helmet can set Cross-Origin-Resource-Policy in a way that blocks cross-origin <Image> thumbnails.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Security Headers
app.use(helmet());

// Body parser
app.use(express.json());
app.use(cors());


// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Rate Limiting Config
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all /api routes
app.use('/api', apiLimiter);

// Root / health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Farmer Market Hub API is running',
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Farmer Market Hub API is running',
    version: '1.0.0'
  });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const stockRoutes = require('./routes/stockRoutes');
const marketRoutes = require('./routes/marketRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const adminDeliveryRoutes = require('./routes/adminDeliveryRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const reportRoutes = require('./routes/reportRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminDeliveryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);

// =======================
// Global Error Handler (NFR-03)
// =======================
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  
  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ 
      statusCode: 400, 
      message: 'Validation Error', 
      errors: messages 
    });
  }
  
  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      statusCode: 400, 
      message: 'Invalid ID format' 
    });
  }
  
  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      statusCode: 400, 
      message: 'File too large. Max 2MB allowed.' 
    });
  }
  
  // Handle duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({ 
      statusCode: 400, 
      message: 'Duplicate entry - this record already exists' 
    });
  }
  
  // Default error response (NFR-03: structured JSON with message and statusCode)
  res.status(err.statusCode || 500).json({ 
    statusCode: err.statusCode || 500, 
    message: err.message || 'Internal Server Error' 
  });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ 
    statusCode: 404, 
    message: 'Route not found' 
  });
});

// Main Server Startup logic (if this file is run directly)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('Missing required environment variable: MONGO_URI');
      process.exit(1);
    }

    try {
      await mongoose.connect(uri, {
        family: 4,
        serverSelectionTimeoutMS: 30000,
      });
      console.log('MongoDB connected');
    } catch (err) {
      console.error('MongoDB connection error:');
      console.error(err);
      if (err.code === 'ECONNREFUSED' && err.message.includes('querySrv')) {
        console.error('SRV DNS lookup failed. Your machine may not be able to resolve Atlas SRV records.');
        console.error('Use the standard mongodb:// replica set URI from Atlas instead of mongodb+srv://.');
      }

      const allowMemoryFallback =
        process.env.NODE_ENV !== 'production' &&
        process.env.DISABLE_MEMORY_DB_FALLBACK !== 'true';

      if (!allowMemoryFallback) {
        process.exit(1);
      }

      console.warn('Atlas connection failed. Starting local in-memory MongoDB for development.');
      console.warn('Data created in this fallback database is temporary and resets when the server stops.');

      const mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri(), {
        family: 4,
        serverSelectionTimeoutMS: 30000,
      });
      console.log('MongoDB connected using in-memory fallback');
      return mongoServer;
    }
  };

connectDB()
    .then(async (mongoServer) => {
      // Seed users on first connection
      const User = require('./models/User');
      const bcrypt = require('bcryptjs');
      
      const adminExists = await User.findOne({ role: 'Admin' });
      if (!adminExists) {
        const salt = await bcrypt.genSalt(10);
        await User.create({
          name: 'Admin',
          email: 'admin@farmersmarket.com',
          password: await bcrypt.hash('admin123', salt),
          role: 'Admin',
          isApproved: true
        });
        console.log('✅ Admin seeded');
      }
      
      const farmerExists = await User.findOne({ email: 'farmer@test.com' });
      if (!farmerExists) {
        const salt = await bcrypt.genSalt(10);
        await User.create({
          name: 'Test Farmer',
          email: 'farmer@test.com',
          password: await bcrypt.hash('Farmer123@', salt),
          role: 'Farmer',
          isApproved: true,
          profileDetails: { phone: '0712345678', businessName: 'Test Farm' }
        });
        console.log('✅ Farmer seeded');
      }
      
      const customerExists = await User.findOne({ email: 'customer@test.com' });
      if (!customerExists) {
        const salt = await bcrypt.genSalt(10);
        await User.create({
          name: 'Test Customer',
          email: 'customer@test.com',
          password: await bcrypt.hash('Customer123@', salt),
          role: 'Customer',
          isApproved: true
        });
        console.log('✅ Customer seeded');
      }

      const {
        ensureDefaultCategories,
        migrateLegacyStockCategories
      } = require('./utils/ensureCategories');
      await migrateLegacyStockCategories();
      await ensureDefaultCategories();

      const StockModel = require('./models/Stock');
      try {
        const indexes = await StockModel.collection.indexes();
        const legacyUniqueNames = indexes
          .filter((idx) => {
            const key = idx?.key || {};
            const hasFarmer = Object.prototype.hasOwnProperty.call(key, 'farmerId');
            const hasHarvest = Object.prototype.hasOwnProperty.call(key, 'harvestDate');
            const hasNameField =
              Object.prototype.hasOwnProperty.call(key, 'name') ||
              Object.prototype.hasOwnProperty.call(key, 'vegetableName');
            return Boolean(idx?.unique && hasFarmer && hasHarvest && hasNameField);
          })
          .map((idx) => idx.name);

        for (const idxName of legacyUniqueNames) {
          await StockModel.collection.dropIndex(idxName);
          console.log(`✅ Dropped legacy unique stock index: ${idxName}`);
        }
      } catch (idxErr) {
        const msg = String(idxErr?.message || '');
        if (
          idxErr?.code !== 27 &&
          !msg.includes('index not found') &&
          !msg.includes('ns not found')
        ) {
          console.warn('Stock index cleanup:', idxErr.message);
        }
      }

      console.log('========================================');
      console.log('🎉 USERS READY:');
      console.log('Admin: admin@farmersmarket.com / admin123');
      console.log('Farmer: farmer@test.com / Farmer123@');
      console.log('Customer: customer@test.com / Customer123@');
      console.log('========================================');

      const { syncExpiredMarketListings } = require('./jobs/syncExpiredListings');
      syncExpiredMarketListings()
        .then((n) => {
          if (n > 0) console.log(`📦 Marked ${n} expired stock row(s) off marketplace`);
        })
        .catch((e) => console.error('Expired listing sync failed:', e.message));
      setInterval(() => {
        syncExpiredMarketListings().catch((e) => console.error('Expired listing sync failed:', e.message));
      }, 60 * 60 * 1000);

      const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
      const shutdown = async () => {
        server.close(async () => {
          await mongoose.disconnect();
          if (mongoServer) {
            await mongoServer.stop();
          }
          process.exit(0);
        });
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`\n❌ Port ${PORT} is already in use.`);
          console.error(`   Free it: netstat -ano | findstr ":${PORT}"  then  taskkill /PID <pid> /F`);
      console.error('   Dev API URL must match frontend/.env, for example EXPO_PUBLIC_API_URL=http://<your-ip>:5002/api.\n');
        } else {
          console.error(err);
        }
        process.exit(1);
      });
    })
    .catch(() => {
      console.error('Startup aborted due to MongoDB connection failure.');
    });
}

module.exports = app;
