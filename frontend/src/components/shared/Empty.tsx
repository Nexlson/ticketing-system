'use client';
import { ReactNode } from 'react';

interface EmptyProps {
  title: string;
  body: string;
  action?: ReactNode;
}

export default function Empty({ title, body, action }: EmptyProps) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
