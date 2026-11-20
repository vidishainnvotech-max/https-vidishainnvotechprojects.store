import { brand } from "../../config/brand";
import "./brand-logo.css";

function BrandLogo({
  className = "",
  markClassName = "",
  copyClassName = "",
  nameClassName = "",
  subtitle = "",
  subtitleClassName = "",
  nameTag: NameTag = "span",
}) {
  return (
    <span className={`brand-logo${className ? ` ${className}` : ""}`}>
      <span className={`brand-logo__mark${markClassName ? ` ${markClassName}` : ""}`} aria-hidden="true">
        SS
      </span>
      <span className={`brand-logo__copy${copyClassName ? ` ${copyClassName}` : ""}`}>
        <NameTag className={`brand-logo__name${nameClassName ? ` ${nameClassName}` : ""}`}>
          {brand.name}
        </NameTag>
        {subtitle && <small className={subtitleClassName}>{subtitle}</small>}
      </span>
    </span>
  );
}

export default BrandLogo;
