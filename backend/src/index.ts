import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import authRoutes from './routes/authRoutes';
import customerRoutes from './routes/customerRoutes';
import loanRoutes from './routes/loanRoutes';
import paymentRoutes from './routes/paymentRoutes';
import settingRoutes from './routes/settingRoutes';
import reportRoutes from './routes/reportRoutes';
import marketRateRoutes from './routes/marketRateRoutes';
import transactionRoutes from './routes/transactionRoutes';
import collateralRoutes from './routes/collateralRoutes';
import formulaRoutes from './routes/formulaRoutes';
import { MarketRateService } from './services/marketRateService';

const app = express();
const PORT = process.env.PORT || 5000;

// Sync market rates every hour. node-cron is ESM-only, so load it dynamically from CommonJS output.
void import('node-cron')
  .then(({ default: cron }) => {
    cron.schedule('0 * * * *', async () => {
      console.log('Running hourly market rate sync...');
      await MarketRateService.syncAll('SYSTEM');
    });
  })
  .catch((error) => {
    console.error('Failed to schedule market rate sync:', error);
  });

// Enable CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Body parsers with limits for base64 document uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve document uploads statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Prefix API Routing
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/market-rates', marketRateRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/collateral', collateralRoutes);
app.use('/api/formulas', formulaRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Loan Management System (LMS) API.' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ message: 'Internal server error occurred.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`LMS Server running on port ${PORT}...`);
});
