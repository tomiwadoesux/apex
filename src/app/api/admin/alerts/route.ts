// /admin's Telegram + WhatsApp alert setup. Saved on the server, so changes apply
// at once with no redeploy. The bot token and CallMeBot key never go back to the
// browser.
//
// GET → the setup as /admin shows it.
// POST { action, ... }:
//   telegram:set-bot { token }     check the token with Telegram and save it
//   telegram:find                  who messaged the bot and isn't connected yet
//   telegram:connect { id, name }  send them a confirmation, then add them
//   telegram:disconnect { id }
//   telegram:remove-bot
//   whatsapp:set { phone, key }    send a confirmation through CallMeBot, then save
//   whatsapp:remove

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { normalizeWhatsApp, sendTelegramMessage, sendWhatsApp, telegramChatsSeen, telegramGetMe } from "@/lib/notify";
import { loadNotifySettings, setNotifySettings, type NotifySettings } from "@/lib/notifySettings";

export const runtime = "nodejs";

const view = (s: NotifySettings) => ({
  telegram: { bot: s.telegramBot, chats: s.telegramChats },
  whatsapp: { phone: s.whatsappPhone || null },
});

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const reason = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
  if (!(await isAdmin())) return fail("Unauthorized", 401);
  try {
    return NextResponse.json(view(await loadNotifySettings()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(`Couldn't load the alert setup (${reason(e)}).`, 503);
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Unauthorized", 401);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  let s: NotifySettings;
  try {
    s = await loadNotifySettings();
  } catch (e) {
    return fail(`Couldn't load the alert setup (${reason(e)}).`, 503);
  }

  try {
    switch (body.action) {
      case "telegram:set-bot": {
        // Accepts BotFather's whole message too: the token is picked out of it.
        const token = /\d{5,}:[\w-]{30,}/.exec(str(body.token, 2000))?.[0];
        if (!token) return fail("That isn't a bot token. It looks like 123456789:AAH… (copy the whole token @BotFather sent).");
        const bot = await telegramGetMe(token);
        // A new token for the same bot keeps the people already connected.
        const sameBot = s.telegramToken.split(":")[0] === token.split(":")[0];
        s = { ...s, telegramToken: token, telegramBot: bot, telegramChats: sameBot ? s.telegramChats : [] };
        break;
      }
      case "telegram:find": {
        if (!s.telegramToken) return fail("Add the bot first.");
        const connected = new Set(s.telegramChats.map((c) => c.id));
        const seen = (await telegramChatsSeen(s.telegramToken)).filter((c) => !connected.has(c.id));
        return NextResponse.json({ ...view(s), seen }, { headers: { "Cache-Control": "no-store" } });
      }
      case "telegram:connect": {
        const id = str(body.id, 40);
        if (!s.telegramToken || !/^-?\d+$/.test(id)) return fail("Couldn't connect that chat.");
        await sendTelegramMessage(s.telegramToken, id, "✅ <b>Connected.</b> New ApexRide bookings and payments will be sent here.");
        if (!s.telegramChats.some((c) => c.id === id)) {
          s = { ...s, telegramChats: [...s.telegramChats, { id, name: str(body.name, 80) || id }].slice(0, 20) };
        }
        break;
      }
      case "telegram:disconnect": {
        const id = str(body.id, 40);
        s = { ...s, telegramChats: s.telegramChats.filter((c) => c.id !== id) };
        break;
      }
      case "telegram:remove-bot":
        s = { ...s, telegramToken: "", telegramBot: null, telegramChats: [] };
        break;
      case "whatsapp:set": {
        const phone = normalizeWhatsApp(str(body.phone, 30));
        const key = str(body.key, 60);
        if (phone.length < 11 || !key) return fail("Enter the WhatsApp number and the key CallMeBot sent to it.");
        await sendWhatsApp(phone, key, "✅ Connected. New ApexRide bookings and payments will be sent here.");
        s = { ...s, whatsappPhone: phone, whatsappKey: key };
        break;
      }
      case "whatsapp:remove":
        s = { ...s, whatsappPhone: "", whatsappKey: "" };
        break;
      default:
        return fail("Unknown action.");
    }
  } catch (e) {
    // Telegram or CallMeBot said no: pass their reason on, save nothing.
    return fail(reason(e), 502);
  }

  try {
    await setNotifySettings(s);
  } catch (e) {
    return fail(`Couldn't save (${reason(e)}).`, 503);
  }
  return NextResponse.json(view(s), { headers: { "Cache-Control": "no-store" } });
}
