"use client";
/**
 * RiskGauge — animated semi-circular gauge for the composite risk score.
 * Client-only because the fill animates on mount via stroke-dashoffset.
 * Color follows five zones (green → lime → amber → orange → red) based on
 * the score. Zones live in `RISK_ZONES`; logic stays out of JSX (C12).
 */
import { useEffect, useState } from "react";

interface RiskGaugeProps {
  readonly score: number;
  readonly rating: string;
}

interface Zone {
  readonly max: number;
  readonly color: string;
}

const RISK_ZONES: ReadonlyArray<Zone> = [
  { max: 20, color: "#00dc82" },
  { max: 40, color: "#84cc16" },
  { max: 60, color: "#ffc107" },
  { max: 80, color: "#fb923c" },
  { max: 100, color: "#ff4757" },
];

const RADIUS = 80;
const STROKE = 14;
const CIRCUMFERENCE = Math.PI * RADIUS;

function colorForScore(score: number): string {
  for (const zone of RISK_ZONES) {
    if (score <= zone.max) return zone.color;
  }
  return RISK_ZONES[RISK_ZONES.length - 1]!.color;
}

export function RiskGauge({ score, rating }: RiskGaugeProps): JSX.Element {
  const safeScore = Math.max(0, Math.min(100, score));
  const [progress, setProgress] = useState(0);
  const color = colorForScore(safeScore);

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(safeScore));
    return () => cancelAnimationFrame(id);
  }, [safeScore]);

  const dashOffset = CIRCUMFERENCE * (1 - progress / 100);

  return (
    <div className="flex flex-col items-center rounded-xl border border-[#1e2130] bg-[#11131a] p-8 mb-6">
      <div className="text-xs font-semibold uppercase tracking-[1.5px] text-[#64748b] mb-4">
        Dark Risk Score
      </div>
      <svg viewBox="0 0 200 110" className="w-[220px] h-auto">
        <path
          d={`M ${100 - RADIUS} 100 A ${RADIUS} ${RADIUS} 0 0 1 ${100 + RADIUS} 100`}
          fill="none"
          stroke="#1e2130"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={`M ${100 - RADIUS} 100 A ${RADIUS} ${RADIUS} 0 0 1 ${100 + RADIUS} 100`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
        />
        <text
          x={100}
          y={88}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={36}
          fontWeight={700}
          fill="#f0f0f0"
        >
          {safeScore}
        </text>
        <text
          x={100}
          y={104}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={11}
          fill="#64748b"
        >
          / 100
        </text>
      </svg>
      <div
        className="mt-3 text-base font-semibold tracking-wider"
        style={{ color }}
      >
        {rating}
      </div>
    </div>
  );
}

