import React from "react";

export const DonutChart = ({
  segments = [],
  total,
  centerLabel,
  centerSubLabel,
  size = 80,
}) => {
  const totalVal = total || 0;
  const radius = 28;
  const circumference = 175.92; // Consistent with the existing hardcoded 175.92

  let currentRotation = 0;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center shrink-0 select-none"
    >
      <svg
        style={{ width: size, height: size }}
        className="transform -rotate-90"
        viewBox="0 0 80 80"
      >
        {/* Background circle */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="stroke-gray-100 fill-none stroke-[8px]"
        />

        {/* Segments */}
        {segments.map((seg, idx) => {
          if (seg.value <= 0) return null;

          const pct = totalVal ? (seg.value / totalVal) * circumference : 0;
          const offset = circumference - pct;
          const rotation = currentRotation;

          // Accumulate rotation for the next segment
          currentRotation += totalVal ? (seg.value / totalVal) * 360 : 0;

          return (
            <circle
              key={idx}
              cx="40"
              cy="40"
              r={radius}
              className={`fill-none stroke-[8.5px] ${seg.colorClass}`}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={rotation > 0 ? `rotate(${rotation} 40 40)` : undefined}
            />
          );
        })}
      </svg>
      <div className="absolute text-center leading-none flex flex-col items-center justify-center">
        <span className="text-xs-portal font-black text-brand-primary">
          {centerLabel ?? totalVal}
        </span>
        <span className="text-2xs text-gray-400 font-extrabold uppercase mt-0.5 tracking-wider">
          {centerSubLabel ?? "Total"}
        </span>
      </div>
    </div>
  );
};
