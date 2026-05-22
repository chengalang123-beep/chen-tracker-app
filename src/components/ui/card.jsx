import React from "react";

export function Card({ children, className = "", ...props }) {
  return (
    <div className={`bg-white border border-slate-200 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "", ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}