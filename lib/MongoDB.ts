import mongoose from "mongoose";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set in the environment variables.`);
  }
  return value;
}

const DATABASE_URL = requireEnv("DATABASE_URL");

type MongoCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var __mongoCache: MongoCache | undefined;
}

const cached: MongoCache = global.__mongoCache ?? {
  conn: null,
  promise: null,
};

export async function connectMongo() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    cached.promise = mongoose
      .connect(DATABASE_URL, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      })
      .then((mongooseInstance) => {
        return mongooseInstance;
      });
  }

  cached.conn = await cached.promise;
  global.__mongoCache = cached;
  return cached.conn;
}
