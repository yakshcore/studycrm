import { Router, Response } from 'express';
import path from 'path';
import multer from 'multer';
import mongoose from 'mongoose';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getIo } from '../socket/emitter';
import { notify } from '../utils/notify';

const router = Router();

// ── Multer (chat file uploads) ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename:    (_req, file,  cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

// ── Conversations ────────────────────────────────────────────────────────────

router.get('/conversations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await Conversation.find({ participants: req.user!.id })
      .populate('participants', 'name email avatar role')
      .populate('studentId', 'personal')
      .sort('-updatedAt');
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/conversations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await Conversation.create(req.body);
    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

/** Find or create a 1-on-1 conversation between the caller and a participant */
router.post('/conversation', authenticate, async (req: AuthRequest, res: Response) => {
  const { participantId } = req.body;
  const myId = req.user!.id;
  try {
    let conv = await Conversation.findOne({
      participants: { $all: [myId, participantId], $size: 2 },
    });
    if (!conv) {
      conv = await Conversation.create({ participants: [myId, participantId], updatedAt: new Date() });
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── Text messages ─────────────────────────────────────────────────────────────

router.post('/send', authenticate, async (req: AuthRequest, res: Response) => {
  const { conversationId, text } = req.body;
  try {
    const message = await Message.create({
      conversationId,
      senderId:   req.user!.id,
      senderName: req.user!.name,
      text,
      readBy: [req.user!.id],
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { text, senderId: req.user!.id, createdAt: new Date(), readBy: [req.user!.id] },
      updatedAt: new Date(),
    });

    const io = getIo();
    if (io) io.to(conversationId).emit('receive_message', message.toObject());

    // Notify the other participants (fire-and-forget)
    const conv = await Conversation.findById(conversationId);
    if (conv) {
      const others = conv.participants
        .map(p => p.toString())
        .filter(p => p !== req.user!.id);
      const preview = text.length > 120 ? text.slice(0, 117) + '…' : text;
      const isStudent = req.user!.role === 'student';
      notify(others, {
        type:  'message',
        title: `💬 ${req.user!.name}`,
        body:  preview,
        link:  isStudent ? undefined : '/chat',
      }).catch(() => {});
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── File upload in chat ───────────────────────────────────────────────────────
/**
 * POST /api/messages/send-file   (multipart/form-data)
 * Fields: file, conversationId, studentId? (required when student uploads so we
 *         also create a Document record for their profile)
 */
router.post('/send-file', authenticate, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }

  const { conversationId, studentId } = req.body as Record<string, string>;
  if (!conversationId) { res.status(400).json({ message: 'conversationId is required' }); return; }

  const fileUrl  = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;

  try {
    // Create chat message
    const message = await Message.create({
      conversationId,
      senderId:   req.user!.id,
      senderName: req.user!.name,
      type:       'file',
      fileUrl,
      fileName,
      readBy: [req.user!.id],
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { text: `📎 ${fileName}`, senderId: req.user!.id, createdAt: new Date() },
      updatedAt: new Date(),
    });

    // If a studentId was provided (student uploading their own doc), also create a Document record
    if (studentId) {
      const DocumentModel = (await import('../models/Document')).default;
      const now     = new Date();
      const version = {
        fileUrl,
        fileName,
        uploadedAt: now,
        uploadedBy: new mongoose.Types.ObjectId(req.user!.id),
      };
      const existing = await DocumentModel.findOne({ studentId, type: 'other', label: fileName });
      if (existing) {
        existing.versions.push(version);
        existing.currentVersion = version;
        existing.status = 'uploaded';
        await existing.save();
      } else {
        await DocumentModel.create({
          studentId:      new mongoose.Types.ObjectId(studentId),
          type:           'other',
          label:          fileName,
          status:         'uploaded',
          currentVersion: version,
          versions:       [version],
        });
      }
    }

    // Emit real-time to other participants
    const io = getIo();
    if (io) io.to(conversationId).emit('receive_message', message.toObject());

    // Notify the other participants in the conversation
    const conv = await Conversation.findById(conversationId);
    if (conv) {
      const others = conv.participants
        .map(p => p.toString())
        .filter(p => p !== req.user!.id);

      const isStudent = req.user!.role === 'student';
      await notify(others, {
        type:  'document',
        title: isStudent ? '📎 File Shared by Student' : '📎 File from Counsellor',
        body:  isStudent
          ? `${req.user!.name} shared a file in chat: ${fileName}`
          : `Your counsellor shared a file: ${fileName}`,
      });
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── GET messages in a conversation ───────────────────────────────────────────

router.get('/:conversationId', authenticate, async (req, res: Response) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId })
      .populate('senderId', 'name avatar')
      .sort('createdAt');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

/** Generic send — used by CRM counsellor chat */
router.post('/:conversationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const message = await Message.create({
      ...req.body,
      conversationId: req.params.conversationId,
      senderId:       req.user!.id,
    });

    await Conversation.findByIdAndUpdate(req.params.conversationId, {
      lastMessage: {
        text:      req.body.text || req.body.fileName || 'File',
        senderId:  req.user!.id,
        createdAt: new Date(),
      },
      updatedAt: new Date(),
    });

    const populated = await message.populate('senderId', 'name avatar');

    const io = getIo();
    if (io) io.to(req.params.conversationId).emit('receive_message', populated.toObject());

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
