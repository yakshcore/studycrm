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

// ── Text / structured messages ────────────────────────────────────────────────

/** Human-readable preview for the conversation list */
function previewFor(type: string | undefined, text?: string, meta?: Record<string, unknown>): string {
  switch (type) {
    case 'form_request':  return `📝 ${(meta?.title as string) || 'Details requested'}`;
    case 'form_response': return `📝 Details submitted`;
    case 'document_request': return `📋 ${text || 'Documents requested'}`;
    case 'file': return `📎 ${text || 'File'}`;
    default: return text || '';
  }
}

router.post('/send', authenticate, async (req: AuthRequest, res: Response) => {
  const { conversationId, text, type = 'text', meta, replyTo } = req.body;
  try {
    const message = await Message.create({
      conversationId,
      senderId:   req.user!.id,
      senderName: req.user!.name,
      type,
      text,
      meta,
      replyTo,
      readBy: [req.user!.id],
    });

    const preview = previewFor(type, text, meta);
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { text: preview, senderId: req.user!.id, createdAt: new Date(), readBy: [req.user!.id] },
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
      const notifBody = preview.length > 120 ? preview.slice(0, 117) + '…' : preview;
      const isStudent = req.user!.role === 'student';
      notify(others, {
        type:  'message',
        title: `💬 ${req.user!.name}`,
        body:  notifBody,
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

// ── Form responses (student answers a counsellor's in-chat form) ─────────────
/**
 * POST /api/messages/form-response
 * Body: { conversationId, formMessageId, answers: [{ id, label, value }] }
 */
router.post('/form-response', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { conversationId, formMessageId, answers } = req.body as {
    conversationId: string;
    formMessageId: string;
    answers: Array<{ id: string; label: string; value: string }>;
  };
  if (!conversationId || !formMessageId || !Array.isArray(answers)) {
    res.status(400).json({ message: 'conversationId, formMessageId and answers are required' }); return;
  }
  try {
    const formMsg = await Message.findById(formMessageId);
    if (!formMsg || formMsg.type !== 'form_request') {
      res.status(404).json({ message: 'Form request not found' }); return;
    }
    const formMeta = (formMsg.meta ?? {}) as { title?: string; answered?: boolean };
    if (formMeta.answered) { res.status(409).json({ message: 'Form already answered' }); return; }

    const response = await Message.create({
      conversationId,
      senderId:   req.user!.id,
      senderName: req.user!.name,
      type: 'form_response',
      meta: { formMessageId, title: formMeta.title, answers },
      readBy: [req.user!.id],
    });

    formMsg.meta = { ...formMeta, answered: true, responseId: response._id.toString() };
    formMsg.markModified('meta');
    await formMsg.save();

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { text: '📝 Details submitted', senderId: req.user!.id, createdAt: new Date() },
      updatedAt: new Date(),
    });

    const io = getIo();
    if (io) {
      io.to(conversationId).emit('receive_message', response.toObject());
      io.to(conversationId).emit('message_updated', formMsg.toObject());
    }

    const conv = await Conversation.findById(conversationId);
    if (conv) {
      const others = conv.participants.map(p => p.toString()).filter(p => p !== req.user!.id);
      notify(others, {
        type:  'message',
        title: `📝 ${req.user!.name} submitted details`,
        body:  formMeta.title || 'Form response received',
        link:  '/chat',
      }).catch(() => {});
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── Read receipts ─────────────────────────────────────────────────────────────
/** POST /api/messages/:conversationId/read — mark everything in the conversation read */
router.post('/:conversationId/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await Message.updateMany(
      { conversationId: req.params.conversationId, readBy: { $ne: req.user!.id } },
      { $addToSet: { readBy: req.user!.id } },
    );
    const io = getIo();
    if (io) io.to(req.params.conversationId).emit('messages_read', {
      conversationId: req.params.conversationId,
      userId: req.user!.id,
    });
    res.json({ ok: true });
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
