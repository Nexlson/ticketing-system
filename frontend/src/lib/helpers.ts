export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export const fmtMoney = (n: number) => `$${n.toFixed(0)}`;

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

export const fmtDateShort = (iso: string) => {
  const d = new Date(iso);
  return {
    m: d.toLocaleDateString('en-US', { month: 'short' }),
    d: d.getDate(),
  };
};

export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
