import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().min(10).max(20).optional(),
    password: z.string().min(6).max(100),
    name: z.string().min(1).max(100),
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone is required"
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().min(10).max(20).optional(),
    password: z.string().min(1),
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone is required"
  }),
});

// User schemas
export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    status: z.string().max(255).optional(),
    avatar: z.string().url().optional(),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Contact schemas
export const addContactSchema = z.object({
  body: z.object({
    contactId: z.string().uuid(),
    nickname: z.string().max(100).optional(),
  }),
});

export const removeContactSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Conversation schemas
export const createConversationSchema = z.object({
  body: z.object({
    type: z.enum(['private', 'group']),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
    memberIds: z.array(z.string().uuid()).min(1),
  }),
});

export const getConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const addMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid(),
    isAdmin: z.boolean().optional().default(false),
  }),
});

export const removeMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
  }),
});

// Message schemas
export const sendMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // conversation id
  }),
  body: z.object({
    type: z.enum(['text', 'image', 'video', 'audio', 'document']),
    content: z.string().max(4000).optional(),
    fileUrl: z.string().url().optional(),
    fileName: z.string().max(255).optional(),
    fileSize: z.number().int().positive().optional(),
    fileMimeType: z.string().max(100).optional(),
    replyToId: z.string().uuid().optional(),
  }).refine(data => {
    if (data.type === 'text') {
      return data.content && data.content.trim().length > 0;
    }
    return data.fileUrl && data.fileName && data.fileSize && data.fileMimeType;
  }, {
    message: "Text messages require content, file messages require file details"
  }),
});

export const getMessagesSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // conversation id
  }),
  querystring: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    before: z.string().datetime().optional(),
    after: z.string().datetime().optional(),
  }),
});

export const editMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // message id
  }),
  body: z.object({
    content: z.string().min(1).max(4000),
  }),
});

export const deleteMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // message id
  }),
});

// Reaction schemas
export const addReactionSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // message id
  }),
  body: z.object({
    emoji: z.string().max(10).min(1),
  }),
});

export const removeReactionSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // message id
    reactionId: z.string().uuid(),
  }),
});

// Upload schema
export const uploadSchema = z.object({
  querystring: z.object({
    type: z.enum(['image', 'video', 'audio', 'document']).optional(),
  }),
});

// Response schemas for documentation
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  name: z.string(),
  avatar: z.string().nullable(),
  status: z.string().nullable(),
  lastSeen: z.string().datetime().nullable(),
  isOnline: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: userResponseSchema,
});

export const contactResponseSchema = z.object({
  id: z.string().uuid(),
  contact: userResponseSchema,
  nickname: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const conversationResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['private', 'group']),
  name: z.string().nullable(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  members: z.array(z.object({
    id: z.string().uuid(),
    user: userResponseSchema,
    isAdmin: z.boolean(),
    joinedAt: z.string().datetime(),
  })),
  lastMessage: z.object({
    id: z.string().uuid(),
    content: z.string().nullable(),
    type: z.enum(['text', 'image', 'video', 'audio', 'document']),
    sender: userResponseSchema,
    createdAt: z.string().datetime(),
  }).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const messageResponseSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  sender: userResponseSchema,
  type: z.enum(['text', 'image', 'video', 'audio', 'document']),
  content: z.string().nullable(),
  fileUrl: z.string().nullable(),
  fileName: z.string().nullable(),
  fileSize: z.number().nullable(),
  fileMimeType: z.string().nullable(),
  replyTo: z.object({
    id: z.string().uuid(),
    content: z.string().nullable(),
    sender: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
  }).nullable(),
  reactions: z.array(z.object({
    id: z.string().uuid(),
    emoji: z.string(),
    user: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
    createdAt: z.string().datetime(),
  })),
  isEdited: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const uploadResponseSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  size: z.number(),
  mimeType: z.string(),
});

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});
