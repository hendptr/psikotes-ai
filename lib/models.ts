import { randomUUID } from "crypto";
import { Schema, model, models, InferSchemaType } from "mongoose";

const optionsSchema = new Schema(
  {
    label: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    category: { type: String, required: true },
    difficulty: { type: String, required: true },
    questionType: { type: String, required: true },
    questionText: { type: String, required: true },
    options: { type: [optionsSchema], required: true },
    correctOptionLabel: { type: String, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      default: null,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    collection: "users",
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

const testSessionSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      index: true,
      ref: "User",
    },
    userType: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      required: true,
    },
    questionCount: {
      type: Number,
      required: true,
      min: 1,
    },
    customDurationSeconds: {
      type: Number,
      default: null,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
    draftSavedAt: {
      type: Date,
      default: null,
    },
    draftQuestionIndex: {
      type: Number,
      default: null,
    },
    draftTimerSeconds: {
      type: Number,
      default: null,
    },
    startedAt: {
      type: Date,
      default: () => new Date(),
    },
    completedAt: {
      type: Date,
      default: null,
    },
    questionsJson: {
      type: [questionSchema],
      required: true,
    },
    score: {
      type: Number,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    publicId: {
      type: String,
      default: undefined,
    },
  },
  {
    collection: "testSessions",
    timestamps: true,
  }
);
testSessionSchema.index({ isPublic: 1, updatedAt: -1 });
testSessionSchema.index(
  { publicId: 1 },
  { unique: true, partialFilterExpression: { publicId: { $exists: true, $type: "string" } } }
);

const questionInstanceSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      ref: "TestSession",
    },
    index: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    questionType: {
      type: String,
      required: true,
    },
  },
  {
    collection: "questionInstances",
    timestamps: true,
  }
);

questionInstanceSchema.index({ sessionId: 1, index: 1 }, { unique: true });

const answerSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      index: true,
      ref: "User",
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      ref: "TestSession",
    },
    questionId: {
      type: String,
      default: null,
      ref: "QuestionInstance",
    },
    questionIndex: {
      type: Number,
      required: true,
    },
    selectedLabel: {
      type: String,
      required: true,
    },
    correctLabel: {
      type: String,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      required: true,
    },
    timeSpentMs: {
      type: Number,
      required: true,
      min: 0,
    },
    answeredAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    collection: "answers",
    timestamps: true,
  }
);

answerSchema.index({ sessionId: 1, questionIndex: 1 }, { unique: true });
answerSchema.index({ userId: 1, sessionId: 1 });

const kreplinSectionSchema = new Schema(
  {
    index: { type: Number, required: true },
    correct: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const kreplinSpeedBucketSchema = new Schema(
  {
    index: { type: Number, required: true },
    correct: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const kreplinResultSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      index: true,
      ref: "User",
    },
    mode: {
      type: String,
      enum: ["manual", "auto", "tryout"],
      required: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 1,
    },
    totalSections: {
      type: Number,
      default: null,
    },
    totalAnswered: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCorrect: {
      type: Number,
      required: true,
      min: 0,
    },
    totalIncorrect: {
      type: Number,
      required: true,
      min: 0,
    },
    accuracy: {
      type: Number,
      required: true,
      min: 0,
    },
    perSectionStats: {
      type: [kreplinSectionSchema],
      default: [],
    },
    speedTimeline: {
      type: [kreplinSpeedBucketSchema],
      default: [],
    },
  },
  {
    collection: "kreplinResults",
    timestamps: true,
  }
);

kreplinResultSchema.index({ userId: 1, createdAt: -1 });

const bookSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    pdfPath: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 1,
    },
    coverImagePath: {
      type: String,
      default: null,
    },
    coverImageUrl: {
      type: String,
      default: null,
    },
    createdBy: {
      type: String,
      default: null,
      ref: "User",
    },
  },
  {
    collection: "books",
    timestamps: true,
  }
);

bookSchema.index({ createdAt: -1 });

const bookProgressSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      index: true,
      ref: "User",
    },
    bookId: {
      type: String,
      required: true,
      index: true,
      ref: "Book",
    },
    status: {
      type: String,
      enum: ["not_started", "reading", "completed"],
      default: "not_started",
    },
    lastPage: {
      type: Number,
      default: 1,
      min: 1,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
  },
  {
    collection: "bookProgress",
    timestamps: true,
  }
);

bookProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });

const bookAnnotationPointSchema = new Schema(
  {
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const bookAnnotationStrokeSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["pen", "circle", "cross"],
      default: "pen",
    },
    color: { type: String, required: true },
    width: { type: Number, required: true, min: 0.5 },
    points: { type: [bookAnnotationPointSchema], required: true },
  },
  { _id: false }
);

const bookAnnotationSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      index: true,
      ref: "User",
    },
    bookId: {
      type: String,
      required: true,
      index: true,
      ref: "Book",
    },
    page: {
      type: Number,
      required: true,
      min: 1,
    },
    strokes: {
      type: [bookAnnotationStrokeSchema],
      default: [],
    },
  },
  {
    collection: "bookAnnotations",
    timestamps: true,
  }
);

bookAnnotationSchema.index({ userId: 1, bookId: 1, page: 1 }, { unique: true });

const toJsonTransform = {
  virtuals: true,
  versionKey: false,
  transform: (_: unknown, ret: Record<string, unknown>) => {
    if (ret._id) {
      ret.id = ret._id;
      delete ret._id;
    }
    return ret;
  },
};

userSchema.set("toJSON", toJsonTransform);
testSessionSchema.set("toJSON", toJsonTransform);
questionInstanceSchema.set("toJSON", toJsonTransform);
answerSchema.set("toJSON", toJsonTransform);
kreplinResultSchema.set("toJSON", toJsonTransform);
bookSchema.set("toJSON", toJsonTransform);
bookProgressSchema.set("toJSON", toJsonTransform);
bookAnnotationSchema.set("toJSON", toJsonTransform);

export const UserModel =
  models.User ?? model("User", userSchema);

export const TestSessionModel =
  models.TestSession ?? model("TestSession", testSessionSchema);

export const QuestionInstanceModel =
  models.QuestionInstance ?? model("QuestionInstance", questionInstanceSchema);

export const AnswerModel =
  models.Answer ?? model("Answer", answerSchema);

export const KreplinResultModel =
  models.KreplinResult ?? model("KreplinResult", kreplinResultSchema);

export const BookModel =
  models.Book ?? model("Book", bookSchema);

export const BookProgressModel =
  models.BookProgress ?? model("BookProgress", bookProgressSchema);

export const BookAnnotationModel =
  models.BookAnnotation ?? model("BookAnnotation", bookAnnotationSchema);

export type QuestionOption = InferSchemaType<typeof optionsSchema>;
export type PsychotestQuestion = InferSchemaType<typeof questionSchema>;
export type UserDocument = InferSchemaType<typeof userSchema> & { id: string };
export type TestSessionDocument = InferSchemaType<typeof testSessionSchema> & { id: string };
export type QuestionInstanceDocument = InferSchemaType<typeof questionInstanceSchema> & { id: string };
export type AnswerDocument = InferSchemaType<typeof answerSchema> & { id: string };
export type KreplinResultDocument = InferSchemaType<typeof kreplinResultSchema> & { id: string };
export type BookDocument = InferSchemaType<typeof bookSchema> & { id: string };
export type BookProgressDocument = InferSchemaType<typeof bookProgressSchema> & { id: string };
export type BookAnnotationDocument = InferSchemaType<typeof bookAnnotationSchema> & { id: string };
