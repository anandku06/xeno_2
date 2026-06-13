import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sendRoutes from './routes/send';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'channel-stub', timestamp: new Date().toISOString() });
});

// Routes
app.use('/send', sendRoutes);

app.listen(PORT, () => {
  console.log(`📡 Channel Stub running on http://localhost:${PORT}`);
});

export default app;
