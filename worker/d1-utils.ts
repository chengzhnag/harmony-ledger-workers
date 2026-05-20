import { Context } from "hono";
import { ApiResponse } from "@shared/types";
/**
 * Harmony Ledger - D1 Architecture Optimization
 * Streamlined to use D1 SQLite exclusively while maintaining compatibility with the main Env.
 */
export interface Env {
  DB: D1Database;
  AI: Ai;
  JWT_SECRET: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  errorCode?: string; // 错误码，用于前端 i18n 映射
}

export const ok = <T>(c: Context, data: T) => c.json({ success: true, data } as ApiResponse<T>);
export const bad = (c: Context, error: string, errorCode?: string) => c.json({ success: false, error, errorCode } as ApiErrorResponse, 400);
export const notFound = (c: Context, error = 'not found', errorCode?: string) => c.json({ success: false, error, errorCode } as ApiErrorResponse, 404);
export class D1Helper {
  static async findById<T>(db: D1Database, table: string, id: string): Promise<T | null> {
    return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<T>();
  }
  static async list<T>(
    db: D1Database,
    table: string,
    familyId: string,
    options: { orderBy?: string; columns?: string } = {}
  ): Promise<T[]> {
    const { orderBy = 'timestamp DESC', columns = '*' } = options;
    const { results } = await db.prepare(
      `SELECT ${columns} FROM ${table} WHERE family_id = ? ORDER BY ${orderBy}`
    ).bind(familyId).all<T>();
    return results || [];
  }
  static async delete(db: D1Database, table: string, id: string): Promise<boolean> {
    const { success } = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return success;
  }
}