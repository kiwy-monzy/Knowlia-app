import React from "react";

export function SidebarMenuButton({
  asChild,
  className,
  tooltip,
  children,
  ...props
}: {
  asChild?: boolean;
  className?: string;
  tooltip?: { children: React.ReactNode; hidden?: boolean };
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  // Simple tooltip implementation (replace with your preferred tooltip lib if needed)
  return (
    <div className={className} title={tooltip && !tooltip.hidden ? String(tooltip.children) : undefined} {...props}>
      {children}
    </div>
  );
} 