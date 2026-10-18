import { toSVG } from "bwip-js/node";
import encoders from "jsbarcode/bin/barcodes";
import { BARCODE_FORMATS } from "./barcode-formats";
import { CODE_GROUPS, RMQR_VERSIONS } from "./code-types";

type Fill = { tab: string; type: string; value: string };
type Rules = { label: string; rule: string; numeric?: boolean; upper?: boolean };

const sanitize = (value: string, t: Rules) => (t.numeric ? value.replace(/\D/g, "") : t.upper ? value.toUpperCase() : value);

function renders(render: () => unknown) {
  try {
    render();
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks a non-QR code value the same way its tab renders it (JsBarcode for the Barcode tab, bwip-js for the rest).
 * Returns null when it renders, or a short explanation for the user.
 */
export function codeProblem(code: Fill): string | null {
  const wanted = code.type.toLowerCase();
  if (code.tab === "barcode") {
    const f = BARCODE_FORMATS.find((x) => x.id.toLowerCase() === wanted || x.label.toLowerCase() === wanted);
    if (!f) return `I don’t know the barcode type “${code.type}”.`;
    const value = sanitize(code.value, f);
    const Encoder = encoders[f.id];
    const ok = Boolean(value) && Boolean(Encoder) && renders(() => {
      if (!new Encoder(value, {}).valid()) throw new Error("invalid");
    });
    return ok ? null : `“${code.value}” isn’t a valid ${f.label} value. ${f.rule}`;
  }

  const group = CODE_GROUPS.find((g) => g.id === code.tab);
  const t = group?.types.find((x) => x.bcid.toLowerCase() === wanted || x.label.toLowerCase() === wanted);
  if (!group || !t) return `I don’t know the code type “${code.type}”.`;
  const value = sanitize(code.value, t);
  const base = { bcid: t.bcid, text: value, ...t.options } as Parameters<typeof toSVG>[0];
  const ok =
    Boolean(value) &&
    (t.bcid === "rectangularmicroqrcode"
      ? RMQR_VERSIONS.some((version) => renders(() => toSVG({ ...base, version } as Parameters<typeof toSVG>[0])))
      : renders(() => toSVG(base)));
  return ok ? null : `“${code.value}” isn’t a valid ${t.label} value. ${t.rule}`;
}
