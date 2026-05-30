import { Router, Response } from 'express';
import path from 'path';
import multer from 'multer';
import mongoose from 'mongoose';
import DocumentModel from '../models/Document';
import { authenticate, AuthRequest } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename:    (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    const docs = await DocumentModel.find(filter)
      .populate('studentId', 'personal')
      .populate('reviewedBy', 'name email')
      .populate('currentVersion.uploadedBy', 'name')
      .sort('-createdAt');
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users have read-only document access' }); return;
  }
  try {
    const doc = await DocumentModel.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST /api/documents/upload — multipart file upload from student portal
router.post('/upload', authenticate, async (req: AuthRequest, res: Response, next) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users have read-only document access' }); return;
  }
  next();
}, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }
  const { studentId, type, label } = req.body;
  if (!studentId || !type) { res.status(400).json({ message: 'studentId and type are required' }); return; }

  const fileUrl  = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;
  const now      = new Date();
  const version  = { fileUrl, fileName, uploadedAt: now, uploadedBy: new mongoose.Types.ObjectId(req.user!.id) };

  try {
    // Check if a document of this type already exists for the student
    const existing = await DocumentModel.findOne({ studentId, type });
    if (existing) {
      // Add a new version
      existing.versions.push(version);
      existing.currentVersion = version;
      existing.status = 'uploaded';
      await existing.save();
      res.json(existing);
    } else {
      const doc = await DocumentModel.create({
        studentId: new mongoose.Types.ObjectId(studentId as string),
        type, label: label || undefined,
        status: 'uploaded',
        currentVersion: version,
        versions: [version],
      });
      res.status(201).json(doc);
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.get('/:id', authenticate, async (req, res: Response) => {
  try {
    const doc = await DocumentModel.findById(req.params.id)
      .populate('reviewedBy', 'name email')
      .populate('currentVersion.uploadedBy', 'name');
    if (!doc) { res.status(404).json({ message: 'Document not found' }); return; }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users have read-only document access' }); return;
  }
  try {
    const doc = await DocumentModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) { res.status(404).json({ message: 'Document not found' }); return; }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// PUT /api/documents/:id/status — review workflow
router.put('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, rejectionReason, notes } = req.body;
    const updateData: Record<string, unknown> = {
      status,
      reviewedBy: req.user!.id,
    };
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
    if (notes) updateData.notes = notes;

    const doc = await DocumentModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('reviewedBy', 'name email');

    if (!doc) { res.status(404).json({ message: 'Document not found' }); return; }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'university') {
    res.status(403).json({ message: 'University users have read-only document access' }); return;
  }
  try {
    await DocumentModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
