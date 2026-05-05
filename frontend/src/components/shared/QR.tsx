'use client';
import { useMemo } from 'react';

interface QRProps {
  value: string;
  size?: number;
}

export default function QR({ value, size = 84 }: QRProps) {
  const grid = useMemo(() => {
    const N = 21;
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 131 + value.charCodeAt(i)) >>> 0;
    const cells: boolean[][] = [];
    for (let y = 0; y < N; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < N; x++) {
        h = (h * 1664525 + 1013904223) >>> 0;
        row.push((h & 0xff) > 110);
      }
      cells.push(row);
    }
    const stamp = (cx: number, cy: number) => {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ax = Math.abs(dx), ay = Math.abs(dy);
          const ring = Math.max(ax, ay);
          if (cy + dy < 0 || cy + dy >= N || cx + dx < 0 || cx + dx >= N) continue;
          cells[cy + dy][cx + dx] =
            ring === 3 ? false : ring === 2 ? false : ring === 1 ? false : true;
        }
      }
    };
    stamp(3, 3); stamp(N - 4, 3); stamp(3, N - 4);
    return cells;
  }, [value]);

  const N = grid.length;
  const cs = size / N;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="white" />
      {grid.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect key={`${x}-${y}`} x={x * cs} y={y * cs} width={cs} height={cs} fill="#18181b" />
          ) : null,
        ),
      )}
    </svg>
  );
}
