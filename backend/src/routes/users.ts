import { Router, Response } from 'express';
import User from '../models/User';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users — list all (admin+)
router.get('/', authenticate, authorize('super_admin','admin','counsellor_manager'), async (_req, res: Response) => {
  try {
    const users = await User.find({ isActive: true }).select('-password').sort('name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET /api/users/counsellors — list counsellors only
router.get('/counsellors', authenticate, async (_req, res: Response) => {
  try {
    const counsellors = await User.find({ role: { $in: ['counsellor','counsellor_manager'] }, isActive: true }).select('name email role avatar');
    res.json(counsellors);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST /api/users — create user (admin+)
router.post('/', authenticate, authorize('super_admin','admin'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST /api/users/student-account — create a portal account for a student (admin+)
router.post('/student-account', authenticate, authorize('super_admin','admin','counsellor_manager'), async (req: AuthRequest, res: Response) => {
  const { studentId, name, email, password } = req.body;
  if (!studentId || !email || !password) {
    res.status(400).json({ message: 'studentId, email, and password are required' });
    return;
  }
  try {
    const existing = await User.findOne({ email });
    if (existing) { res.status(400).json({ message: 'An account with this email already exists' }); return; }
    const user = await User.create({ name, email, password, role: 'student', studentId });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// PUT /api/users/:id — update user
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password, ...updateData } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
