import { Router } from 'express';
import { createCourse, getCourses } from '../controllers/courseController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.post('/', authenticateJWT, createCourse);
router.get('/', getCourses);

export default router; 