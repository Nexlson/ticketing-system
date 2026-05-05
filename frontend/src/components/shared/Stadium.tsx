'use client';
import { STADIUM } from '@/lib/constants';

interface StadiumProps {
  occupied?: Set<string>;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  mode?: 'view' | 'pick' | 'ticket';
  tierFilter?: string;
  highlight?: string[];
}

export default function Stadium({
  occupied = new Set(),
  selected = new Set(),
  onToggle,
  mode = 'pick',
  tierFilter,
  highlight = [],
}: StadiumProps) {
  const W = 720;
  const H = 460;

  const seats: {
    id: string; section: string; tier: string; color: string;
    row: number; seat: number; x: number; y: number;
  }[] = [];

  const padX = 30;
  const bandTop = 50;
  const bandH = 80;

  STADIUM.sections.forEach((sec, sIdx) => {
    const yBase = bandTop + sIdx * bandH;
    const fan = 0.06;
    for (let r = 0; r < sec.rows; r++) {
      const rowY = yBase + r * 14;
      const seatsInRow = sec.perRow;
      const totalRowW = (seatsInRow - 1) * 18;
      const startX = (W - totalRowW) / 2;
      for (let c = 0; c < seatsInRow; c++) {
        const id = `${sec.id}-${r + 1}-${c + 1}`;
        const mid = (seatsInRow - 1) / 2;
        const dx = c - mid;
        const fanY =
          sIdx === 0 ? -Math.abs(dx) * fan * 1.2
          : sIdx === 3 ? Math.abs(dx) * fan * 1.2
          : 0;
        seats.push({
          id,
          section: sec.id,
          tier: sec.tier,
          color: sec.color,
          row: r + 1,
          seat: c + 1,
          x: startX + c * 18,
          y: rowY + fanY,
        });
      }
    }
  });

  const isOccupied = (id: string) => occupied.has(id);
  const isSelected = (id: string) => selected.has(id);
  const isHighlighted = (id: string) => highlight.includes(id);

  const seatColor = (s: typeof seats[0]) => {
    if (isOccupied(s.id) && !isHighlighted(s.id)) return '#dc2626';
    if (isHighlighted(s.id)) return 'var(--accent)';
    if (isSelected(s.id)) return 'var(--accent)';
    if (tierFilter && s.tier !== tierFilter) return '#e5e5ea';
    return s.color;
  };

  const seatStroke = (s: typeof seats[0]) =>
    isSelected(s.id) ? '#1e1b4b' : 'rgba(0,0,0,0.05)';

  const handleClick = (s: typeof seats[0]) => {
    if (mode !== 'pick') return;
    if (isOccupied(s.id)) return;
    if (tierFilter && s.tier !== tierFilter) return;
    onToggle?.(s.id);
  };

  const sectionLabels = STADIUM.sections.map((sec, idx) => {
    const y = bandTop + idx * bandH + ((sec.rows - 1) * 14) / 2 + 4;
    return (
      <text key={sec.id} x={20} y={y} fontSize="11" fontWeight="700" fill="#71717a" textAnchor="start">
        {sec.id}
      </text>
    );
  });

  return (
    <div className="stadium">
      <div className="stadium__stage">▼ STAGE ▼</div>
      <svg className="stadium__svg" viewBox={`0 0 ${W} ${H}`}>
        <rect x="8" y="20" width={W - 16} height={H - 40} rx="40"
          fill="#fafafa" stroke="#e5e5ea" strokeWidth="1" />
        {sectionLabels}
        {seats.map((s) => (
          <g
            key={s.id}
            onClick={() => handleClick(s)}
            style={{
              cursor:
                mode === 'pick' && !isOccupied(s.id) && (!tierFilter || s.tier === tierFilter)
                  ? 'pointer'
                  : 'default',
            }}
          >
            <circle
              cx={s.x}
              cy={s.y}
              r="5"
              fill={seatColor(s)}
              stroke={seatStroke(s)}
              strokeWidth={isSelected(s.id) ? 1.5 : 0.5}
            >
              <title>{s.id}{isOccupied(s.id) ? ' — taken' : ''}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="stadium__legend">
        {STADIUM.sections.map((sec) => (
          <div key={sec.id} className="stadium__legend-item">
            <span className="stadium__legend-swatch" style={{ background: sec.color }} />
            Sec {sec.id}
          </div>
        ))}
        <div className="stadium__legend-item">
          <span className="stadium__legend-swatch" style={{ background: '#dc2626' }} />
          Occupied
        </div>
        {mode === 'pick' && (
          <div className="stadium__legend-item">
            <span className="stadium__legend-swatch" style={{ background: 'var(--accent)' }} />
            Selected
          </div>
        )}
      </div>
    </div>
  );
}
