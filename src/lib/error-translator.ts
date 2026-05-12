import { t } from 'i18next';
import { ApiError } from './api-client';

/**
 * 将后端 API 错误码翻译为当前语言的错误提示
 * 用法: toast.error(translateApiError(err))
 */
export function translateApiError(error: unknown): string {
  // 处理 ApiError 对象（有 errorCode 属性）
  if (error && typeof error === 'object' && 'errorCode' in error) {
    const apiError = error as ApiError;
    if (apiError.errorCode) {
      return t(`errors.${apiError.errorCode}`, { defaultValue: t('errors.default') });
    }
  }
  // 处理普通 Error 对象
  if (error instanceof Error) {
    const msg = error.message;
    // 如果 message 本身就是错误码（如 UNAUTHORIZED），尝试翻译
    if (/^[A-Z_]+$/.test(msg)) {
      return t(`errors.${msg}`, { defaultValue: msg });
    }
    return msg;
  }
  // 处理字符串
  if (typeof error === 'string') {
    if (/^[A-Z_]+$/.test(error)) {
      return t(`errors.${error}`, { defaultValue: error });
    }
    return error;
  }
  return t('errors.default');
}
