'use client';
import App from '@/components/App';
import { ToastProvider } from '@/components/shared/Toast';

export default function Page() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
