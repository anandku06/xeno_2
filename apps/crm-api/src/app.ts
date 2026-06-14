import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './routes/customers';
import orderRoutes from './routes/orders';
import campaignRoutes from './routes/campaigns';
import segmentRoutes from './routes/segments';
import aiRoutes from './routes/ai';
import receiptRoutes from './routes/receipt';
import { startSendWorker } from './workers/sendWorker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:3001';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'crm-api', timestamp: new Date().toISOString() });
});

// Routes
app.use('/customers', customerRoutes);
app.use('/orders', orderRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/segments', segmentRoutes);
app.use('/ai', aiRoutes);
app.use('/receipt', receiptRoutes);

// Start worker
startSendWorker();

app.listen(PORT, () => {
  console.log(`🚀 CRM API running on ${CRM_API_URL}`);
});

export default app;
