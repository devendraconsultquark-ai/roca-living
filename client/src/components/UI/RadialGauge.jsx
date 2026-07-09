import React from "react";

export const RadialGauge = ({
  percentage,
  color = "stroke-status-success",
}) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0 select-none">
      <svg className="w-16 h-16 transform -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          className="stroke-gray-100 fill-none stroke-[2.5]"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          className={`fill-none stroke-[2.5] transition-all duration-300 ${color}`}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center leading-none text-center p-1.5">
        <span className="text-xs-portal font-black text-brand-primary">
          {percentage}%
        </span>
        <span className="text-2xs text-gray-400 font-extrabold uppercase mt-0.5 tracking-wider">
          Compliant
        </span>
      </div>
    </div>
  );
};
