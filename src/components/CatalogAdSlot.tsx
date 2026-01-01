import { ContentSlot } from "@/components/ContentSlot";

type CatalogAdSlotProps = {
  className?: string;
  minHeight?: number | string;
};

const CATALOG_AD_SLOT = "3359244124";

export function CatalogAdSlot({ className, minHeight }: CatalogAdSlotProps) {
  const resolvedClassName = className ? `w-full ${className}` : "w-full";

  return (
    <ContentSlot
      slot={CATALOG_AD_SLOT}
      className={resolvedClassName}
      adLayout={null}
      adFormat="auto"
      fullWidthResponsive
      minHeight={minHeight}
    />
  );
}
