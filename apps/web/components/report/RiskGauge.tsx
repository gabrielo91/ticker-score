"use client";
/**
 * RiskGauge — animated semi-circular gauge for the composite risk score.
 * Client-only because the fill animates on mount via stroke-dashoffset.
 * Color follows five zones (green → lime → amber → orange → red); zone
 * lookup and geometry live in `RiskGauge.helpers` (C12).
 */
import { useEffect, useState } from "react";
import { CIRCUMFERENCE, RADIUS, STROKE, colorForScore } from "./RiskGauge.helpers";

interface RiskGaugeProps {
  readonly score: number;
  readonly rating: string;
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

