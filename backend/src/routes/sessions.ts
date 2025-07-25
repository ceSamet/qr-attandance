import { Router } from 'express';
import { createSession, getSessionsByCourse } from '../controllers/sessionController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.post('/', authenticateJWT, createSession);
router.get('/:courseId', getSessionsByCourse);

export default router; 