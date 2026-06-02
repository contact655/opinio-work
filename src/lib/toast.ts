/**
 * Global toast event bus — fire from any component without prop drilling.
 * Usage: import { showToast } from '@/lib/toast';
 *        showToast('保存しました ✓');
 *        showToast('エラーが発生しました', 'error');
 */

export type ToastVariant = 'default' | 'success' | 'error' | 'warm';

export interface ToastEvent {
  message: string;
  variant?: ToastVariant;
  id?: string;
}

const EVENT_NAME = 'opinio-toast';

export function showToast(message: string, variant: ToastVariant = 'default') {
  if (typeof window === 'undefined') return;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.dispatchEvent(
    new CustomEvent<ToastEvent>(EVENT_NAME, { detail: { message, variant, id } })
  );
}

export { EVENT_NAME as TOAST_EVENT_NAME };
