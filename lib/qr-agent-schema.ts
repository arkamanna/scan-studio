import { z } from "zod";

const n = <T extends z.ZodType>(t: T) => t.nullable();

export const THEME_NAMES = ["Classic", "Night", "Aurora", "Sunset", "Forest", "Love"] as const;
export const CONTENT_KINDS = ["link", "text", "wifi", "contact", "email", "phone", "sms", "whatsapp", "location", "event"] as const;

export const LINK_TARGET_IDS = ["direct", "whatsapp", "sms", "email", "telegram"] as const;
export const TEXT_TARGET_IDS = ["plain", "whatsapp", "sms", "email", "telegram", "search", "translate", "maps"] as const;
export const TAB_IDS = ["qr", "barcode", "datamatrix", "aztec", "pdf417", "gs1", "postal", "more", "scan"] as const;
export const QR_ACTIONS = ["download_png", "download_svg", "print", "copy_image", "share"] as const;

export const agentContentSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  target: n(z.enum([...new Set([...LINK_TARGET_IDS, ...TEXT_TARGET_IDS])] as [string, ...string[]])).describe(
    "link: direct (default) or share via whatsapp/sms/email/telegram. text: plain (default), whatsapp/sms/email/telegram, search, translate, maps",
  ),
  url: n(z.string()),
  text: n(z.string()),
  ssid: n(z.string()),
  password: n(z.string()).describe("exactly as given"),
  security: n(z.enum(["WPA", "WEP", "nopass"])).describe("WPA unless told otherwise"),
  hidden: n(z.boolean()),
  firstName: n(z.string()),
  lastName: n(z.string()),
  org: n(z.string()),
  jobTitle: n(z.string()),
  phone: n(z.string()).describe("with country code when known"),
  email: n(z.string()),
  website: n(z.string()),
  address: n(z.string()),
  subject: n(z.string()),
  body: n(z.string()),
  message: n(z.string()).describe("sms/whatsapp text"),
  place: n(z.string()).describe("address, place or lat,lng"),
  mapApp: n(z.enum(["google", "apple", "geo"])),
  eventTitle: n(z.string()),
  start: n(z.string()).describe("YYYY-MM-DDTHH:mm"),
  end: n(z.string()).describe("YYYY-MM-DDTHH:mm"),
  location: n(z.string()),
  description: n(z.string()),
});

const hex = z.string().describe("#rrggbb");

export const agentDesignSchema = z.object({
  theme: n(z.enum(THEME_NAMES)).describe("base theme; other fields override it"),
  dots: n(z.enum(["square", "rounded", "dots", "diamond", "star", "heart", "leaf", "plus"])),
  frame: n(z.enum(["square", "rounded", "circle", "leaf"])).describe("corner frames"),
  ball: n(z.enum(["square", "rounded", "circle", "diamond", "leaf"])).describe("corner centres"),
  fillType: n(z.enum(["solid", "linear", "radial"])),
  color: n(hex).describe("dots / first gradient colour"),
  color2: n(hex),
  angle: n(z.number()),
  eyeColor: n(hex).describe("corner colour"),
  background: n(hex),
  transparent: n(z.boolean()),
  caption: n(z.string()).describe("text under the code"),
  captionColor: n(hex),
  captionSize: n(z.number()).describe("4-12, default 7"),
  logoSize: n(z.number()).describe("10-30, needs a logo"),
  logoClear: n(z.boolean()),
});

export const agentReplySchema = z.object({
  status: z.enum(["ask", "create", "off_topic", "reply"]),
  message: z.string(),
  questions: n(
    z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.string()).describe("2-5 choices; [] when typed"),
        }),
      )
      .max(4),
  ),
  content: n(agentContentSchema),
  design: n(agentDesignSchema),
  ecc: n(z.enum(["L", "M", "Q", "H"])).describe("only when asked"),
  actions: n(z.array(z.enum(QR_ACTIONS))).describe("only when asked"),
  code: n(
    z.object({
      tab: z.enum(["barcode", "datamatrix", "aztec", "pdf417", "gs1", "postal", "more"]),
      type: z.string().describe("type id, e.g. EAN13"),
      value: z.string(),
    }),
  ).describe("non-QR code to fill in"),
  navigate: n(z.enum(TAB_IDS)).describe("open a tab"),
});

export type AgentContent = z.infer<typeof agentContentSchema>;
export type AgentDesign = z.infer<typeof agentDesignSchema>;
export type AgentReply = z.infer<typeof agentReplySchema>;
