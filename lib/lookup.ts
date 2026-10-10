import type { Field } from "./parse";

export type LookupResult = { image?: string; title?: string; rows: Field[]; source: string; link: string } | null;

export async function lookupBook(isbn: string): Promise<LookupResult> {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  const data = (await res.json())[`ISBN:${isbn}`];
  if (!data) return null;
  const rows: Field[] = [];
  const names = (list?: { name: string }[]) => list?.map((x) => x.name).join(", ");
  if (names(data.authors)) rows.push({ label: "Author", value: names(data.authors)! });
  if (names(data.publishers)) rows.push({ label: "Publisher", value: names(data.publishers)! });
  if (data.publish_date) rows.push({ label: "Published", value: data.publish_date });
  if (data.number_of_pages) rows.push({ label: "Pages", value: String(data.number_of_pages) });
  return {
    title: [data.title, data.subtitle].filter(Boolean).join(": "),
    image: data.cover?.medium,
    rows,
    source: "Open Library",
    link: data.url ?? `https://openlibrary.org/isbn/${isbn}`,
  };
}

export async function lookupProduct(code: string): Promise<LookupResult> {
  const fields = "product_name,brands,quantity,categories,image_front_small_url,nutriscore_grade,countries,ingredients_text";
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const rows: Field[] = [];
  if (p.brands) rows.push({ label: "Brand", value: p.brands });
  if (p.quantity) rows.push({ label: "Quantity", value: p.quantity });
  if (p.categories) rows.push({ label: "Category", value: p.categories.split(",").slice(-2).join(", ").trim() });
  if (p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade)) rows.push({ label: "Nutri‑Score", value: p.nutriscore_grade.toUpperCase() });
  if (p.countries) rows.push({ label: "Sold in", value: p.countries });
  if (p.ingredients_text) rows.push({ label: "Ingredients", value: p.ingredients_text });
  return {
    title: p.product_name || undefined,
    image: p.image_front_small_url,
    rows,
    source: "Open Food Facts",
    link: `https://world.openfoodfacts.org/product/${code}`,
  };
}
