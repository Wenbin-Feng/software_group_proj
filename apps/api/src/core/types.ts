import type { FastifyRequest } from "fastify";
import type Database from "better-sqlite3";
export type RecordData = { id: string; [key: string]: any };
export interface User {
  id: string;
  name: string;
  studentId: string;
  role: "student" | "teacher";
  profileComplete: boolean;
  walletAddress: string;
  initials: string;
  color: string;
}
export interface FolioCore {
  db: Database.Database;
  dataDir: string;
  publicUrl: string;
  now: () => number;
  user: (request: FastifyRequest) => User | null;
  userById: (id: string) => User | null;
  requireUser: (request: FastifyRequest) => User;
  workspace: (user: User) => Record<string, any>;
  all: (collection: string) => RecordData[];
  get: (collection: string, id: string) => RecordData | undefined;
  put: (collection: string, record: RecordData) => void;
  canReadCourse: (user: User, id: string) => boolean;
  canTeach: (user: User, id: string) => boolean;
  canReadMaterial: (user: User, record: RecordData) => boolean;
  canReadSession: (user: User, record: RecordData) => boolean;
  canReadNote: (user: User, record: RecordData) => boolean;
}
declare module "fastify" {
  interface FastifyInstance {
    folio: FolioCore;
  }
}
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export const assert = (
  value: unknown,
  status: number,
  message: string,
): asserts value => {
  if (!value) throw new HttpError(status, message);
};
