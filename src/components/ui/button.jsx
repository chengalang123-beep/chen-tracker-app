import React from "react";

export function Button({
  children,
  className = "",
  variant = "default",
  size = "default",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center font-medium transition disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    default: "bg-slate-950 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white hover:bg-slate-50",
    ghost: "hover:bg-slate-100",
  };

  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-9 px-3 text-sm",
    icon: "h-9 w-9",
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.default} ${
        sizes[size] || sizes.default
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}