'use client';

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

export default function Stepper({ value, min = 1, max = 10, onChange }: StepperProps) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        −
      </button>
      <input value={value} readOnly />
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        +
      </button>
    </div>
  );
}
