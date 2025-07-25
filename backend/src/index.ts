import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import sessionRoutes from './routes/sessions';
import attendanceRoutes from './routes/attendances';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/sessions', sessionRoutes);
app.use('/', attendanceRoutes);

// Connect to MongoDB and start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 