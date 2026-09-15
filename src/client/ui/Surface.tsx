import type { ReactNode } from "react";

import "./Surface.css";

export function Surface({
  title,
  hint,
  children,
}: {
  title?: string | undefined;
  hint?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <section className="dz-surface">
      {title !== undefined && <div className="dz-surface-title">{title}</div>}
      {hint !== undefined && <p className="dz-surface-hint">{hint}</p>}
      {children}
    </section>
  );
}
