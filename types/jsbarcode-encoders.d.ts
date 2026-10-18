declare module "jsbarcode/bin/barcodes" {
  const encoders: Record<string, new (data: string, options: object) => { valid(): boolean }>;
  export default encoders;
}
