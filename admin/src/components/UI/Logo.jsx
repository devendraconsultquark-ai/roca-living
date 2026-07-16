import React from "react";

export const Logo = ({
  className = "",
  invert = false,
  collapsed = false,
  useLogoPng = false,
}) => {
  const logoSrc = `${import.meta.env.BASE_URL}images/${
    collapsed ? "short_logo.png" : "logo.png"
  }`;
  return (
    <img
      src={logoSrc}
      alt="ROCA Living"
      className={`${collapsed ? "h-8 w-8" : "h-24 w-24"} object-contain ${
        invert && !useLogoPng ? "brightness-0 invert" : ""
      } ${className}`}
    />
  );
};
