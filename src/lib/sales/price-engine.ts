export type PriceResolution = {
  cartonPrice: number;
  perUnitPrice: number;
  source: "default";
  agreementId: null;
  agreementType: null;
  tpBaseline: number | null;
  marginPercent: number | null;
};

export function resolvePrice(
  customerId: string,
  productId: string,
  requestedPackSize: number,
  basePackSize: number,
  defaultUnitPrice: number,
  customerDefaultMargin?: number | null,
  tpBaseline?: number | null,
): PriceResolution {
  const packRatio = requestedPackSize / (basePackSize || 1);

  if (customerDefaultMargin && customerDefaultMargin > 0 && tpBaseline) {
    const scaledTp = packRatio * tpBaseline;
    const cartonPrice = scaledTp * (1 - customerDefaultMargin / 100);
    return {
      cartonPrice: cartonPrice,
      perUnitPrice: cartonPrice / (requestedPackSize || 1),
      source: "default",
      agreementId: null,
      agreementType: null,
      tpBaseline: scaledTp,
      marginPercent: customerDefaultMargin,
    };
  }

  const defaultCartonPrice = defaultUnitPrice * requestedPackSize;
  return {
    cartonPrice: defaultCartonPrice,
    perUnitPrice: defaultUnitPrice,
    source: "default",
    agreementId: null,
    agreementType: null,
    tpBaseline: null,
    marginPercent: null,
  };
}
