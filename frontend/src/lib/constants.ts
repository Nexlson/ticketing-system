export const TIER_PALETTE = [
  { id: 'vip',      name: 'VIP',      color: '#a78bfa', default: 180 },
  { id: 'premium',  name: 'Premium',  color: '#60a5fa', default: 120 },
  { id: 'standard', name: 'Standard', color: '#34d399', default: 80  },
  { id: 'general',  name: 'General',  color: '#fbbf24', default: 45  },
];

export const STADIUM = {
  sections: [
    { id: 'A', label: 'Sec A', tier: 'vip',      rows: 4, perRow: 12, color: '#a78bfa' },
    { id: 'B', label: 'Sec B', tier: 'premium',  rows: 5, perRow: 14, color: '#60a5fa' },
    { id: 'C', label: 'Sec C', tier: 'standard', rows: 5, perRow: 16, color: '#34d399' },
    { id: 'D', label: 'Sec D', tier: 'general',  rows: 4, perRow: 12, color: '#fbbf24' },
  ],
};

export const STADIUM_TOTAL = STADIUM.sections.reduce((s, x) => s + x.rows * x.perRow, 0);
