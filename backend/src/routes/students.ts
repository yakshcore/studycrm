import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Student from '../models/Student';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.stage) filter.stage = req.query.stage;

    if (req.user?.role === 'student') {
      // Students can only see their own record
      const User = (await import('../models/User')).default;
      const usr = await User.findById(req.user.id);
      if (usr?.studentId) filter._id = usr.studentId;
      else { res.json([]); return; }
    } else if (req.user?.role === 'counsellor') {
      filter.assignedCounsellor = req.user.id;
    } else if (req.user?.role === 'university') {
      // University reps see only students who applied to their institution
      const User = (await import('../models/User')).default;
      const Application = (await import('../models/Application')).default;
      const usr = await User.findById(req.user.id).select('universityName');
      if (!usr?.universityName) { res.json([]); return; }
      const apps = await Application.find({
        university: { $regex: usr.universityName, $options: 'i' },
      }).select('studentId');
      const studentIds = [...new Set(apps.map(a => a.studentId.toString()))];
      filter._id = { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const students = await Student.find(filter)
      .populate('assignedCounsellor', 'name email')
      .sort('-createdAt');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users cannot create student records' }); return;
  }
  try {
    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const student = await Student.findById(req.params.id).populate('assignedCounsellor', 'name email');
    if (!student) { res.status(404).json({ message: 'Student not found' }); return; }

    // University rep — only allow if student has an application to their institution
    if (req.user?.role === 'university') {
      const User = (await import('../models/User')).default;
      const Application = (await import('../models/Application')).default;
      const usr = await User.findById(req.user.id).select('universityName');
      if (!usr?.universityName) { res.status(403).json({ message: 'Access denied' }); return; }
      const app = await Application.findOne({
        studentId: student._id,
        university: { $regex: usr.universityName, $options: 'i' },
      });
      if (!app) { res.status(403).json({ message: 'Access denied' }); return; }
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users cannot modify student records' }); return;
  }
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false })
      .populate('assignedCounsellor', 'name email');
    if (!student) { res.status(404).json({ message: 'Student not found' }); return; }
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// PATCH alias (used by student portal)
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users cannot modify student records' }); return;
  }
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: false })
      .populate('assignedCounsellor', 'name email');
    if (!student) { res.status(404).json({ message: 'Student not found' }); return; }
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// PATCH /api/students/:id/assign-counsellor  — admin / counsellor_manager only
router.patch('/:id/assign-counsellor', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.user || !['super_admin', 'admin', 'counsellor_manager'].includes(req.user.role)) {
    res.status(403).json({ message: 'Insufficient permissions' }); return;
  }
  const { counsellorId } = req.body;
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { assignedCounsellor: counsellorId || null },
      { new: true },
    ).populate('assignedCounsellor', 'name email');
    if (!student) { res.status(404).json({ message: 'Student not found' }); return; }

    const { notify } = await import('../utils/notify');
    const User       = (await import('../models/User')).default;

    // Notify the counsellor being assigned
    if (counsellorId) {
      await notify([counsellorId], {
        type:  'assignment',
        title: '👤 Student Assigned to You',
        body:  `${student.personal.name} has been assigned to you for counselling.`,
        link:  `/students/${student._id}`,
      });
    }

    // Notify the student if they have a portal account
    const studentUser = await User.findOne({ studentId: student._id }).select('_id');
    if (studentUser) {
      const counsellorDoc = student.assignedCounsellor as unknown as { name?: string } | null;
      const cName = counsellorDoc?.name ?? 'A counsellor';
      await notify([studentUser._id.toString()], {
        type:  'assignment',
        title: counsellorId ? '🤝 Counsellor Assigned' : '🔄 Counsellor Updated',
        body:  counsellorId
          ? `${cName} has been assigned as your counsellor. You can now chat with them.`
          : 'Your counsellor assignment has been updated.',
      });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users cannot delete student records' }); return;
  }
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
