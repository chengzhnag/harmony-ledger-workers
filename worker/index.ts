// 注意：现在直接静态导入路由，不再使用动态 import()
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { verify } from 'hono/jwt';
import { Env, ok, bad } from './d1-utils';

// ✅ 1. 静态导入用户路由
import { userRoutes } from './user-routes';
import { aiRoutes } from './ai-routes';

export * from './d1-utils';

export type ClientErrorReport = { message: string; url: string; timestamp: string } & Record<string, unknown>;

declare module 'hono' {
  interface ContextVariableMap {
    user: { id: string; name: string; email: string; activeFamilyId: string; familyIds: string[] };
  }
}

const app = new Hono<{ Bindings: Env }>();

// 中间件
app.use('*', logger());

app.use('/api/*', cors());

// JWT 认证中间件
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }
  const token = authHeader.substring(7);
  try {
    const secret = c.env.JWT_SECRET || 'harmony-ledger-workers-secret';
    console.log('[authMiddleware] Verifying token:', token);
    const decoded = await verify(token, secret, 'HS256');
    console.log('[authMiddleware] Decoded token:', decoded);
    // 直接从 JWT token 中获取用户信息，无需查询数据库
    c.set('user', {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      activeFamilyId: decoded.activeFamilyId,
      familyIds: decoded.familyIds,
    });
    await next();
  } catch (err) {
    console.error('[authMiddleware] Token verification failed:', err);
    return c.json({ success: false, error: 'Token 无效或已过期' }, 401);
  }
};

// 不需要认证的路由
const PUBLIC_PATHS = ['/api/health', '/api/auth/register', '/api/auth/login', '/api/client-errors'];

// 对所有 API 请求应用认证中间件（排除公开路由）
app.use('/api/*', async (c, next) => {
  const path = c.req.path.split('?')[0];
  if (PUBLIC_PATHS.includes(path)) {
    return next();
  }
  return authMiddleware(c, next);
});

// 系统内置路由
// ==========================================
// 系统内置路由
// ==========================================

/**
 * GET /api/health
 * 健康检查接口
 *
 * 响应: { success: true, data: { status: 'healthy', timestamp: string } }
 *
 * 功能: 检查服务是否正常运行，返回当前时间戳
 */
app.get('/api/health', (c) => c.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() }}));

/**
 * POST /api/client-errors
 * 客户端错误上报接口
 *
 * 请求体: { message: string, url: string, timestamp?: string, stack?: string, componentStack?: string, errorBoundary?: any }
 * 响应: { success: true } | { success: false, error: string }
 *
 * 功能: 收集前端错误信息用于调试和监控
 */
app.post('/api/client-errors', async (c) => {
  try {
    const e = await c.req.json<ClientErrorReport>();
    console.error('[CLIENT ERROR]', JSON.stringify({ timestamp: e.timestamp || new Date().toISOString(), message: e.message, url: e.url, stack: e.stack, componentStack: e.componentStack, errorBoundary: e.errorBoundary }, null, 2));
    return c.json({ success: true });
  } catch (error) {
    console.error('[CLIENT ERROR HANDLER] Failed:', error);
    return c.json({ success: false, error: 'Failed to process' }, 500);
  }
});

// ✅ 2. 在应用启动时直接注册用户路由
// @ts-ignore
userRoutes(app);
// ✅ 3. 注册 AI 语音指令路由
// @ts-ignore
aiRoutes(app);

app.notFound((c) => c.json({ success: false, error: 'Not Found' }, 404));
app.onError((err, c) => { console.error(`[ERROR] ${err}`); return c.json({ success: false, error: 'Internal Server Error' }, 500); });

console.log(`Server is running`)

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;