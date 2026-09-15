import { DZ_ICON_SRC } from "../assets/dzIcon.ts";

export function DzBrand({ compact = false, name = "定责工作台" }: { compact?: boolean; name?: string }) {
  return (
    <span className="dz-brand">
      <img className="dz-brand-icon" src={DZ_ICON_SRC} alt="" aria-hidden="true" />
      {!compact && <span className="dz-brand-text">{name}</span>}
    </span>
  );
}
