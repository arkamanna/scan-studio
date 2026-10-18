import { z } from "zod";

const n = <T extends z.ZodType>(t: T) => t.nullable();

export const THEME_NAMES = ["Classic", "Night", "Aurora", "Sunset", "Forest", "Love"] as const;
export const CONTENT_KINDS = ["link", "text", "wifi", "contact", "email", "phone", "sms", "whatsapp", "location", "event"] as const;

export const agentContentSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  url: n(z.string()).describe("link: the URL"),
  text: n(z.string()).describe("text: the plain text to encode"),
  ssid: n(z.string()).describe("wifi: network name"),
  password: n(z.string()).describe("wifi: password, exactly as the user gave it"),
  security: n(z.enum(["WPA", "WEP", "nopass"])).describe("wifi: security type, WPA unless told otherwise or open network"),
  hidden: n(z.boolean()).describe("wifi: hidden network"),
  firstName: n(z.string()),
  lastName: n(z.string()),
  org: n(z.string()),
  jobTitle: n(z.string()),
  phone: n(z.string()).describe("contact / phone / sms / whatsapp: phone number with country code when known"),
  email: n(z.string()).describe("contact / email: email address"),
  website: n(z.string()),
  address: n(z.string()),
  subject: n(z.string()).describe("email: subject"),
  body: n(z.string()).describe("email: body"),
  message: n(z.string()).describe("sms / whatsapp: pre-filled message"),
  place: n(z.string()).describe("location: address, place name or 'lat,lng'"),
  mapApp: n(z.enum(["google", "apple", "geo"])).describe("location: which maps app, google by default"),
  eventTitle: n(z.string()),
  start: n(z.string()).describe("event: local start, format YYYY-MM-DDTHH:mm"),
  end: n(z.string()).describe("event: local end, format YYYY-MM-DDTHH:mm"),
  location: n(z.string()).describe("event: venue"),
  description: n(z.string()).describe("event: details"),
});

const hex = z.string().describe("hex colour like #1e293b");

export const agentDesignSchema = z.object({
  theme: n(z.enum(THEME_NAMES)).describe("starting quick theme; other fields override it"),
  dots: n(z.enum(["square", "rounded", "dots", "diamond", "star", "heart", "leaf", "plus"])),
  frame: n(z.enum(["square", "rounded", "circle", "leaf"])).describe("shape of the three corner frames"),
  ball: n(z.enum(["square", "rounded", "circle", "diamond", "leaf"])).describe("shape of the corner centres"),
  fillType: n(z.enum(["solid", "linear", "radial"])),
  color: n(hex).describe("dot colour (first gradient colour)"),
  color2: n(hex).describe("second gradient colour"),
  angle: n(z.number()).describe("linear gradient angle in degrees"),
  eyeColor: n(hex).describe("corner colour if different from the dots"),
  background: n(hex),
  transparent: n(z.boolean()),
  caption: n(z.string()).describe("short text shown under the code"),
  captionColor: n(hex),
});

export const agentReplySchema = z.object({
  status: z.enum(["ask", "create", "off_topic", "reply"]),
  message: z.string().describe("short, friendly message shown to the user (1-3 sentences)"),
  questions: n(
    z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.string()).describe("2-5 short answer choices; empty when the answer must be typed (e.g. a password)"),
        }),
      )
      .max(4),
  ),
  content: n(agentContentSchema),
  design: n(agentDesignSchema),
});

export type AgentContent = z.infer<typeof agentContentSchema>;
export type AgentDesign = z.infer<typeof agentDesignSchema>;
export type AgentReply = z.infer<typeof agentReplySchema>;
