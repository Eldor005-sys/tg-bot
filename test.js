/**
 * Worker logikasini Telegram'siz (mock fetch bilan) tekshiruvchi test.
 * Ishga tushirish:  node test.js
 */

import assert from "node:assert";
import worker from "./src/index.js";

const ENV = {
  BOT_TOKEN: "TEST:TOKEN",
  GROUP_ID: "-5293441607",
  WEBHOOK_SECRET: "topsecret",
};

const calls = [];
const realFetch = globalThis.fetch;

globalThis.fetch = async (url, opts = {}) => {
  const body = opts.body ? JSON.parse(opts.body) : {};
  calls.push({ method: String(url).split("/").pop(), body });
  return {
    ok: true,
    json: async () => ({ ok: true, result: { message_id: 1 } }),
  };
};

async function postUpdate(update, secret = ENV.WEBHOOK_SECRET) {
  const res = await worker.fetch(
    new Request("https://tgbot-video.test.workers.dev/telegram", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secret },
      body: JSON.stringify(update),
    }),
    ENV
  );
  assert.equal(res.status, 200, `200 kutilardi, keldi: ${res.status}`);
  return res;
}

function msg(extra) {
  return {
    message_id: 10,
    chat: { id: 555, type: "private" },
    from_user: {
      id: 777,
      first_name: "Vali",
      last_name: "Aliyev",
      username: "vali_90",
    },
    ...extra,
  };
}

// --- 1) Noto'g'ri secret → 403 ---------------------------------------------
{
  const res = await worker.fetch(
    new Request("https://x.test/telegram", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "yolgon" },
      body: JSON.stringify({ message: msg({ text: "/start" }) }),
    }),
    ENV
  );
  assert.equal(res.status, 403, "noto'g'ri secret 403 bo'lishi kerak");
}
console.log("1) noto'g'ri webhook secret → 403  OK");

// --- 2) /start --------------------------------------------------------------
{
  calls.length = 0;
  await postUpdate({ message: msg({ text: "/start" }) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "sendMessage");
  assert.equal(calls[0].body.chat_id, 555, "javob foydalanuvchiga ketishi kerak");
  assert.ok(calls[0].body.text.startsWith("Assalomu aleykum"), "start matni");
  assert.equal(calls[0].body.parse_mode, "HTML");
}
console.log("2) /start → javob  OK");

// --- 3) /help va noma'lum buyruq -------------------------------------------
{
  calls.length = 0;
  await postUpdate({ message: msg({ text: "/help" }) });
  assert.ok(calls[0].body.text.includes("Yo'riqnoma"));
  calls.length = 0;
  await postUpdate({ message: msg({ text: "/salom" }) });
  assert.ok(calls[0].body.text.includes("Noma'lum buyruq"));
  calls.length = 0;
  await postUpdate({ message: msg({ text: "/start@mening_bot arg" }) });
  assert.ok(calls[0].body.text.startsWith("Assalomu aleykum"));
}
console.log("3) /help, noma'lum buyruq, /start@bot  OK");

// --- 4) Izohsiz video → ogohlantirish --------------------------------------
{
  calls.length = 0;
  await postUpdate({ message: msg({ video: { file_id: "VIDEO1" } }) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "sendMessage");
  assert.ok(calls[0].body.text.includes("izoh (caption) yo'q"));
}
console.log("4) izohsiz video → caption_required  OK");

// --- 5) Izohli video → guruhga yuboriladi ----------------------------------
{
  calls.length = 0;
  await postUpdate({
    message: msg({
      video: { file_id: "VIDEO1" },
      caption: "TATU / Fizika / Aliyev Vali Ahmedovich",
    }),
  });
  assert.equal(calls.length, 2);
  const sendVideo = calls[0];
  assert.equal(sendVideo.method, "sendVideo");
  assert.equal(sendVideo.body.chat_id, ENV.GROUP_ID, "video guruhga ketadi");
  assert.equal(sendVideo.body.video, "VIDEO1");
  assert.ok(sendVideo.body.caption.includes("Yangi video qabul qilindi"));
  assert.ok(sendVideo.body.caption.includes("Vali Aliyev"));
  assert.ok(sendVideo.body.caption.includes("@vali_90"));
  assert.ok(sendVideo.body.caption.includes("TATU / Fizika"));
  assert.equal(sendVideo.body.parse_mode, "HTML");
  const confirm = calls[1];
  assert.equal(confirm.method, "sendMessage");
  assert.ok(confirm.body.text.includes("qabul qilindi"));
}
console.log("5) izohli video → guruhga yuborish + tasdiq  OK");

// --- 6) HTML xavfsizlashtirish (foydalanuvchi matnida HTML bor) -------------
{
  calls.length = 0;
  await postUpdate({
    message: msg({ video: { file_id: "V2" }, caption: "<b>xavfli</b> & matn" }),
  });
  const caption = calls[0].body.caption;
  assert.ok(!caption.includes("<b>xavfli"), "foydaalanuvchi HTML escape bo'lishi kerak");
  assert.ok(caption.includes("&lt;b&gt;xavfli&lt;/b&gt;"));
  assert.ok(caption.includes("&amp; matn"));
}
console.log("6) HTML escape  OK");

// --- 7) Juda uzun izoh → alohida xabarlar ----------------------------------
{
  calls.length = 0;
  const longCaption = "Sahifa ".repeat(400); // ~2800 belgi, limitdan uzun
  await postUpdate({
    message: msg({ video: { file_id: "V3" }, caption: longCaption }),
  });
  const methods = calls.map((c) => c.method);
  assert.equal(methods[0], "sendMessage", "avval ma'lumot bloki");
  assert.ok(calls[0].body.text.includes("Yangi video qabul qilindi"));
  assert.equal(methods[1], "sendVideo", "keyin video (captionsiz)");
  assert.equal(calls[1].body.caption, undefined);
  assert.equal(methods[2], "sendMessage", "keyin uzun izoh qismlari");
  assert.ok(calls[2].body.text.startsWith("💬"));
  // qismlar 4096 belgidan oshmasligi kerak
  for (const c of calls) {
    if (c.method === "sendMessage") {
      assert.ok(c.body.text.length <= 4096, `xabar juda uzun: ${c.body.text.length}`);
    }
  }
}
console.log("7) uzun izoh → qismlarga bo'lish  OK");

// --- 8) Video emas (matn/rasm) → faqat video ogohlantirishi ----------------
{
  calls.length = 0;
  await postUpdate({ message: msg({ text: "salom" }) });
  assert.ok(calls[0].body.text.includes("Faqat video"));
  calls.length = 0;
  await postUpdate({ message: msg({ photo: [{ file_id: "P1" }] }) });
  assert.ok(calls[0].body.text.includes("Faqat video"));
}
console.log("8) video emas → only_video  OK");

globalThis.fetch = realFetch;
console.log("\nWORKER TEST PASSED ✅");
