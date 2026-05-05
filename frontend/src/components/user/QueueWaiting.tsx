'use client';
import { useEffect, useRef, useState } from 'react';
import { ticketsApi } from '@/lib/api-client';
import type { QueueStatus } from '@/types';

interface QueueWaitingProps {
  tierId: string;
  queueToken: string;
  initialPosition: number;
  initialEstimatedWaitSec: number;
  onWindowActive: (expiresAt: string) => void;
  onLeave: () => void;
}

export default function QueueWaiting({
  tierId,
  queueToken,
  initialPosition,
  initialEstimatedWaitSec,
  onWindowActive,
  onLeave,
}: QueueWaitingProps) {
  const [status, setStatus] = useState<QueueStatus>({
    position: initialPosition,
    isActive: false,
    expiresAt: null,
  });
  const [windowRemaining, setWindowRemaining] = useState(0);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let pollTimer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const s = await ticketsApi.getQueueStatus(tierId, queueToken);
        setStatus(s);
        if (s.isActive && s.expiresAt && !notifiedRef.current) {
          notifiedRef.current = true;
          const secs = Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000));
          setWindowRemaining(secs);
          onWindowActive(s.expiresAt);
        }
      } catch {
        // network blip — keep polling
      }
      pollTimer = setTimeout(poll, 4000);
    };

    pollTimer = setTimeout(poll, 4000);
    return () => clearTimeout(pollTimer);
  }, [tierId, queueToken, onWindowActive]);

  // Countdown for active window
  useEffect(() => {
    if (!status.isActive || windowRemaining <= 0) return;
    const t = setInterval(() => setWindowRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [status.isActive, windowRemaining]);

  const mins = Math.floor(initialEstimatedWaitSec / 60);
  const warnWindow = windowRemaining <= 60;

  if (status.isActive) {
    return (
      <div className={`queue-window ${warnWindow ? 'warn' : ''}`}>
        <div className="queue-window__title">Your turn!</div>
        <div className="queue-window__body">
          Complete your selection and checkout before your window closes.
        </div>
        <div className="queue-window__timer">
          {String(Math.floor(windowRemaining / 60)).padStart(2, '0')}:
          {String(windowRemaining % 60).padStart(2, '0')} remaining
        </div>
      </div>
    );
  }

  return (
    <div className="queue-waiting">
      <div className="queue-waiting__pos">
        <span className="queue-waiting__hash">#</span>
        {status.position}
        <span className="queue-waiting__label"> in line</span>
      </div>
      {mins > 0 && (
        <div className="queue-waiting__est">~{mins} min estimated wait</div>
      )}
      <div className="queue-waiting__hint">
        We'll notify you when it's your turn. Stay on this page.
      </div>
      <button className="btn-ghost" onClick={onLeave} style={{ marginTop: 8, fontSize: 12 }}>
        Leave queue
      </button>
    </div>
  );
}
