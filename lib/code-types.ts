/** Code types generated with bwip-js, grouped into the studio's tabs. */

export type CodeKind = "2d" | "stacked" | "linear" | "postal";

export type CodeType = {
  /** bwip-js encoder id. */
  bcid: string;
  label: string;
  use: string;
  rule: string;
  sample: string;
  kind: CodeKind;
  /** Scan Studio (zxing) can read it back. Postal and some niche codes need dedicated scanners. */
  scannable: boolean;
  /** Text input rather than a single line. */
  multiline?: boolean;
  numeric?: boolean;
  upper?: boolean;
  /** Extra bwip-js options. */
  options?: Record<string, string | number | boolean>;
};

export type CodeGroup = {
  id: string;
  label: string;
  heading: string;
  types: CodeType[];
};

const GS1_RULE = "GS1 element strings with application identifiers in brackets, e.g. (01) GTIN, (17) expiry, (10) batch.";

export const CODE_GROUPS: CodeGroup[] = [
  {
    id: "datamatrix",
    label: "Data Matrix",
    heading: "Data Matrix type",
    types: [
      { bcid: "datamatrix", label: "Data Matrix", use: "Electronics, parts marking, healthcare", rule: "Any text up to about 2,300 characters.", sample: "SN:W1234567 PN:K12345", kind: "2d", scannable: true, multiline: true },
      { bcid: "datamatrixrectangular", label: "Rectangular", use: "Narrow labels, PCB edges, vials", rule: "Any text; shorter values fit best.", sample: "LOT-2026-0042", kind: "2d", scannable: true },
      { bcid: "gs1datamatrix", label: "GS1 DataMatrix", use: "Medicines, medical devices", rule: GS1_RULE, sample: "(01)09521234543213(17)261231(10)LOT42", kind: "2d", scannable: true },
    ],
  },
  {
    id: "aztec",
    label: "Aztec",
    heading: "Aztec type",
    types: [
      { bcid: "azteccode", label: "Aztec Code", use: "Boarding passes, rail & bus tickets", rule: "Any text; needs no quiet zone around it.", sample: "M1DOE/JANE EABC123 DELLHRAI 0123 290Y012A0001 100", kind: "2d", scannable: true, multiline: true },
      { bcid: "azteccodecompact", label: "Compact Aztec", use: "Small tickets and tags", rule: "Short text (up to about 90 characters).", sample: "TICKET 42", kind: "2d", scannable: true },
      { bcid: "aztecrune", label: "Aztec Rune", use: "Tiny IDs, sorting marks", rule: "A whole number from 0 to 255.", sample: "42", kind: "2d", scannable: true, numeric: true },
    ],
  },
  {
    id: "pdf417",
    label: "PDF417",
    heading: "PDF417 type",
    types: [
      { bcid: "pdf417", label: "PDF417", use: "ID cards, driving licences, shipping", rule: "Any text up to about 1,800 characters.", sample: "ANSI 636000090002DL00410278ZV03190008DLDAQT64235789", kind: "stacked", scannable: true, multiline: true },
      { bcid: "pdf417compact", label: "Compact PDF417", use: "Where label width is tight", rule: "Any text; narrower than standard PDF417.", sample: "Compact PDF417 sample", kind: "stacked", scannable: true },
      { bcid: "micropdf417", label: "MicroPDF417", use: "Small items, labels, pharma", rule: "Short text (up to about 150 characters).", sample: "MICRO PDF 417", kind: "stacked", scannable: true },
    ],
  },
  {
    id: "gs1",
    label: "GS1",
    heading: "GS1 type",
    types: [
      { bcid: "gs1-128", label: "GS1-128", use: "Cartons, pallets, logistics labels", rule: GS1_RULE, sample: "(01)09521234543213(3103)000123", kind: "linear", scannable: true },
      { bcid: "databaromni", label: "DataBar Omni", use: "Fresh food, coupons", rule: "(01) followed by a 14-digit GTIN.", sample: "(01)09521234543213", kind: "linear", scannable: true },
      { bcid: "databarexpanded", label: "DataBar Expanded", use: "Weighted produce, coupons", rule: GS1_RULE, sample: "(01)09521234543213(3103)000123", kind: "linear", scannable: true },
      { bcid: "databarexpandedstacked", label: "DataBar Exp. Stacked", use: "Small fresh-food labels", rule: GS1_RULE, sample: "(01)09521234543213(3103)000123(15)261231", kind: "stacked", scannable: true },
      { bcid: "databarstacked", label: "DataBar Stacked", use: "Loose produce stickers", rule: "(01) followed by a 14-digit GTIN.", sample: "(01)09521234543213", kind: "stacked", scannable: true },
      { bcid: "databarlimited", label: "DataBar Limited", use: "Small healthcare items", rule: "(01) and a GTIN starting with 0 or 1.", sample: "(01)09521234543213", kind: "linear", scannable: true },
      { bcid: "ean14", label: "EAN-14", use: "Outer cases of products", rule: "(01) followed by a 14-digit GTIN.", sample: "(01)09521234543213", kind: "linear", scannable: true },
      { bcid: "sscc18", label: "SSCC-18", use: "Pallet & shipment IDs", rule: "(00) followed by 18 digits including the check digit.", sample: "(00)095012345678901237", kind: "linear", scannable: true },
      { bcid: "gs1qrcode", label: "GS1 QR Code", use: "Product links on packaging", rule: GS1_RULE, sample: "(01)09521234543213(8200)https://example.com", kind: "2d", scannable: true },
    ],
  },
  {
    id: "postal",
    label: "Postal",
    heading: "Postal code type",
    types: [
      { bcid: "onecode", label: "USPS Intelligent Mail", use: "US letters and flats", rule: "20-digit tracking code, plus an optional 5, 9 or 11-digit ZIP.", sample: "0123456709498765432101234567891", kind: "postal", scannable: false, numeric: true },
      { bcid: "postnet", label: "POSTNET", use: "Legacy US ZIP codes", rule: "5, 9 or 11 digits.", sample: "01234", kind: "postal", scannable: false, numeric: true },
      { bcid: "planet", label: "PLANET", use: "Legacy US mail tracking", rule: "11 or 13 digits.", sample: "01234567890", kind: "postal", scannable: false, numeric: true },
      { bcid: "royalmail", label: "Royal Mail 4-State", use: "UK mail sorting (RM4SCC)", rule: "Postcode and delivery point, letters and digits.", sample: "LE28HS9Z", kind: "postal", scannable: false, upper: true },
      { bcid: "kix", label: "KIX", use: "Dutch PostNL mail", rule: "Postcode and house number, letters and digits.", sample: "1231FZ13XHS", kind: "postal", scannable: false, upper: true },
      { bcid: "auspost", label: "Australia Post", use: "Australian mail sorting", rule: "FCC + 8-digit sorting code, optional customer info.", sample: "5956439111ABA 9", kind: "postal", scannable: false, upper: true },
      { bcid: "japanpost", label: "Japan Post", use: "Japanese mail sorting", rule: "Postcode and address digits, A–Z and -.", sample: "6540123789-A-K-Z", kind: "postal", scannable: false, upper: true },
      { bcid: "identcode", label: "Deutsche Post Identcode", use: "German parcel tracking", rule: "11 digits (check digit added) or 12.", sample: "563102430313", kind: "linear", scannable: true, numeric: true },
      { bcid: "leitcode", label: "Deutsche Post Leitcode", use: "German mail routing", rule: "13 digits (check digit added) or 14.", sample: "21348075016401", kind: "linear", scannable: true, numeric: true },
    ],
  },
  {
    id: "more",
    label: "More",
    heading: "Other code types",
    types: [
      { bcid: "microqrcode", label: "Micro QR", use: "Tiny parts, small labels", rule: "Short text (up to about 35 digits or 21 characters).", sample: "SCAN42", kind: "2d", scannable: true },
      { bcid: "rectangularmicroqrcode", label: "rMQR", use: "Long, thin spaces on products", rule: "Short text; the narrowest size that fits is chosen.", sample: "https://scan.studio", kind: "2d", scannable: true },
      { bcid: "maxicode", label: "MaxiCode", use: "UPS parcels, sorting", rule: "Up to about 90 characters.", sample: "Scan Studio parcel 0042", kind: "2d", scannable: true },
      { bcid: "dotcode", label: "DotCode", use: "Tobacco, high-speed printing", rule: "Any text.", sample: "Scan Studio 2026", kind: "2d", scannable: false },
      { bcid: "hanxin", label: "Han Xin Code", use: "Chinese government & industry", rule: "Any text, including Chinese characters.", sample: "Scan Studio 汉信码", kind: "2d", scannable: false },
      { bcid: "codeone", label: "Code One", use: "Healthcare, recycling", rule: "Any text.", sample: "Code One sample", kind: "2d", scannable: false },
      { bcid: "codablockf", label: "Codablock F", use: "Healthcare, small labels", rule: "Any text (ASCII).", sample: "CODABLOCK F SAMPLE", kind: "stacked", scannable: false },
      { bcid: "code16k", label: "Code 16K", use: "Small spaces (stacked Code 128)", rule: "Any text (ASCII).", sample: "CODE16K-2026", kind: "stacked", scannable: false },
      { bcid: "code49", label: "Code 49", use: "Small spaces (stacked)", rule: "Any text (ASCII).", sample: "CODE49 2026", kind: "stacked", scannable: false },
      { bcid: "telepen", label: "Telepen", use: "UK libraries, universities", rule: "Any text (ASCII).", sample: "SCAN STUDIO", kind: "linear", scannable: true },
      { bcid: "code32", label: "Code 32", use: "Italian pharmaceuticals", rule: "8 digits (check digit added) or 9.", sample: "01234567", kind: "linear", scannable: true, numeric: true },
      { bcid: "pzn", label: "PZN", use: "German pharmaceuticals", rule: "6 or 7 digits.", sample: "123456", kind: "linear", scannable: true, numeric: true },
      { bcid: "code11", label: "Code 11", use: "Telecom equipment labels", rule: "Digits and -.", sample: "0123452", kind: "linear", scannable: false },
      { bcid: "plessey", label: "Plessey (UK)", use: "Library & retail shelves", rule: "Digits and A–F.", sample: "01234ABCD", kind: "linear", scannable: false, upper: true },
      { bcid: "code2of5", label: "Industrial 2 of 5", use: "Warehouses, airline tickets", rule: "Digits only.", sample: "01234567", kind: "linear", scannable: false, numeric: true },
      { bcid: "channelcode", label: "Channel Code", use: "Very small numbers", rule: "Up to 7 digits.", sample: "3493", kind: "linear", scannable: false, numeric: true },
      { bcid: "pharmacode2", label: "Two-track Pharmacode", use: "Pharmaceutical packaging", rule: "A whole number from 4 to 64570080.", sample: "117480", kind: "linear", scannable: false, numeric: true },
    ],
  },
];

/** rMQR has fixed sizes; bwip-js needs one, so try them from smallest to largest. */
export const RMQR_VERSIONS = [
  "R7x43", "R7x59", "R9x43", "R7x77", "R9x59", "R11x43", "R7x99", "R9x77", "R11x59", "R13x43", "R7x139", "R9x99",
  "R11x77", "R13x59", "R15x43", "R9x139", "R11x99", "R13x77", "R15x59", "R17x43", "R11x139", "R13x99", "R15x77",
  "R17x59", "R13x139", "R15x99", "R17x77", "R15x139", "R17x99", "R17x139",
];
