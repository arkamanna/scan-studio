/** Linear barcode types rendered with JsBarcode in the Barcode tab. */

export type BarcodeFormat = {
  id: string;
  label: string;
  use: string;
  rule: string;
  sample: string;
  /** Example "Text under the bars" filled in when the type is picked. */
  caption: string;
  numeric?: boolean;
  upper?: boolean;
};

export const BARCODE_FORMATS: BarcodeFormat[] = [
  { id: "CODE128", label: "Code 128", use: "General purpose, shipping, inventory", rule: "Any letters, numbers and symbols (ASCII).", sample: "SCAN-STUDIO-2026", caption: "SKU SCAN-STUDIO-2026" },
  { id: "EAN13", label: "EAN-13", use: "Retail products worldwide", rule: "12 digits (check digit is added) or 13 digits.", sample: "590123412345", caption: "5901234123457", numeric: true },
  { id: "UPC", label: "UPC-A", use: "Retail products in US / Canada", rule: "11 digits (check digit is added) or 12 digits.", sample: "03600029145", caption: "036000291452", numeric: true },
  { id: "EAN8", label: "EAN-8", use: "Small retail packages", rule: "7 digits (check digit is added) or 8 digits.", sample: "9638507", caption: "96385074", numeric: true },
  { id: "CODE39", label: "Code 39", use: "Badges, automotive, defence", rule: "A–Z, 0–9, space and - . $ / + %", sample: "BADGE 0042", caption: "Visitor badge 0042", upper: true },
  { id: "CODE93", label: "Code 93", use: "Logistics, compact Code 39", rule: "A–Z, 0–9, space and - . $ / + %", sample: "PARCEL-93", caption: "Parcel PARCEL-93", upper: true },
  { id: "ITF14", label: "ITF-14", use: "Shipping cartons & pallets", rule: "13 digits (check digit is added) or 14 digits.", sample: "1540014128876", caption: "15400141288763", numeric: true },
  { id: "ITF", label: "ITF", use: "Warehouses, distribution", rule: "An even number of digits.", sample: "12345678", caption: "Bin 12-34-56-78", numeric: true },
  { id: "codabar", label: "Codabar", use: "Libraries, blood banks, labs", rule: "Digits and - $ : / . + with optional A–D start/stop letters.", sample: "A40156B", caption: "Library book 40156", upper: true },
  { id: "MSI", label: "MSI Plessey", use: "Shelf labels, stock control", rule: "Digits only.", sample: "1234567", caption: "Shelf 1234567", numeric: true },
  { id: "pharmacode", label: "Pharmacode", use: "Pharmaceutical packaging", rule: "A whole number from 3 to 131070.", sample: "1234", caption: "Pharma 1234", numeric: true },
];
