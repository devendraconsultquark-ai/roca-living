import React from "react";

export const CirclePoundIcon = ({ size = 18, className = "" }) => {
  const fontSize = size <= 16 ? "9px" : "10px";
  const marginTop = size <= 16 ? "-0.5px" : "-1px";

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full border-[1.5px] border-current flex items-center justify-center ${className} shrink-0`}
    >
      <span
        className="font-bold leading-none select-none"
        style={{ fontSize, marginTop }}
      >
        £
      </span>
    </div>
  );
};
