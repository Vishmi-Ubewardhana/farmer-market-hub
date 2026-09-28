const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

dotenv.config();

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(mongoSanitize());
app.use(xss());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
});

app.use('/api', apiLimiter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Farmer Market Hub API is running',
    version: '1.0.0'
  });
});

const authRoutes = require('./routes/authRoutes');
const stockRoutes = require('./routes/stockRoutes');
const marketRoutes = require('./routes/marketRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);

async function start() {
  console.log('🔄 Starting in-memory MongoDB...');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  console.log('Memory DB URI:', mongoUri);

  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB connected');

  const User = require('./models/User');
  const bcrypt = require('bcryptjs');
  
  // Seed admin if not exists
  const adminExists = await User.findOne({ role: 'Admin' });
  if (!adminExists) {
    const salt = await bcrypt.genSalt(10);
    await User.create({
      name: 'Admin User',
      email: 'admin@farmersmarket.com',
      password: await bcrypt.hash('admin123', salt),
      role: 'Admin',
      isApproved: true
    });
    console.log('✅ Admin seeded');
  }

  // Seed farmer if not exists
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

  // Seed customer if not exists
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

  console.log('========================================');
  console.log('🎉 SERVER READY - USE THESE CREDENTIALS:');
  console.log('Admin:    admin@farmersmarket.com / admin123');
  console.log('Farmer:   farmer@test.com / Farmer123@');
  console.log('Customer: customer@test.com / Customer123@');
  console.log('========================================');

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
  
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => {
      mongoose.disconnect();
      process.exit(0);
    });
  });
}

start().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
