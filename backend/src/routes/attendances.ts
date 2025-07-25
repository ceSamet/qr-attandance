import { Router } from 'express';
import { submitAttendance, getAttendancesBySession } from '../controllers/attendanceController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.post('/attend', submitAttendance);
router.get('/sessions/:id/attendances', authenticateJWT, getAttendancesBySession);

export default router; 