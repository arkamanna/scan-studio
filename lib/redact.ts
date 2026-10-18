/** Words that introduce a password, in the languages the agent is most used in. */
const PASSWORD_WORDS = "password|passcode|passwd|pwd|pass|key|पासवर्ड|পাসওয়ার্ড|contraseña|clave|mot de passe|passwort|kennwort|senha";
const WIFI_RE = /wi-?fi|wlan|ssid|router|hotspot|network|वाई-?फाई|ওয়াইফাই|réseau|netzwerk|rede|red wifi/iu;
const FILLER = /^(is|was|=|:|for|and|the|of|to|my|our|है|হল|es|est|ist|é)$/i;
const PASSWORD_RE = new RegExp(`(?<![\\p{L}\\p{M}])(?:${PASSWORD_WORDS})(?![\\p{L}\\p{M}])((?:\\s*(?:is|was|=|:|है|হল|es|est|ist|é))?\\s*["“'‘]?)([^\\s"”'’,;]+)`, "giu");

/**
 * In Wi-Fi conversations, replaces passwords in the user's messages with placeholders like [[SECRET_1]] before they go to an AI
 * provider, and puts them back into the reply afterwards.
 */
export function redactSecrets<T extends { role: string; content: string }>(messages: T[]) {
  const secrets = new Map<string, string>();
  const wifi = messages.some((m) => m.role === "user" && WIFI_RE.test(m.content));
  const byValue = new Map<string, string>();
  const redacted = messages.map((m) => {
    if (!wifi || m.role !== "user") return m;
    const content = m.content.replace(PASSWORD_RE, (match, _lead: string, value: string) => {
      if (FILLER.test(value) || value.length < 3) return match;
      let token = byValue.get(value);
      if (!token) {
        token = `[[SECRET_${secrets.size + 1}]]`;
        secrets.set(token, value);
        byValue.set(value, token);
      }
      return match.slice(0, match.length - value.length) + token;
    });
    return { ...m, content };
  });

  const restore = <R>(reply: R): R => {
    if (!secrets.size) return reply;
    let json = JSON.stringify(reply);
    for (const [token, value] of secrets) json = json.split(token).join(JSON.stringify(value).slice(1, -1));
    return JSON.parse(json) as R;
  };

  return { messages: redacted, restore, count: secrets.size };
}
