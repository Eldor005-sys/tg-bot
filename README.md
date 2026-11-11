# ☁️ Cloudflare Worker'da ishga tushirish (bepul, 24/7)

Bu yo'l botni **Cloudflare Workers** (bepul plan) da ishlatadi:
karta kerak emas, **uxlamaydi**, oyiga 100 000 so'rov yetarli.

> Python/aiogram kodi ishlatilmaydi — bot **webhook** usulida JavaScript
> Worker'ga qayta yozilgan (`src/index.js`). Mantig'i bir xil:
> `/start`, `/help`, video + izoh tekshiruvi, guruhga yuborish.

---

## ⚠️ Birinchi qadam: lokal botni to'xtating

Cloudflare bot ishga tushganda, **eski lokal bot ham o'chirilishi shart** —
chunki `run.py` ishga tushganda Telegram'dan webhook ni **o'chirib tashlaydi**
va ikkala bot bir xil yangiliklar uchun raqobatlashadi.

```powershell
cd C:\Users\Admin\Downloads\tgbot
powershell -ExecutionPolicy Bypass -File .\service.ps1 -Action stop
```

---

## Yo'l A — Dashboard orqali (kodni qo'lda joylash, shart emas)

1. **https://dash.cloudflare.com** ga ro'yxatdan o'ting (bepul, karta kerak emas).
2. **Workers & Pages → Create → Create Worker** → nom: `tgbot-video` → **Deploy**.
3. **Edit code** ni bosing → `src/index.js` dagi butun kodni joylashtiring → **Deploy**.
4. **Settings → Variables and Secrets** ga 3 ta qiymat qo'shing:

   | Nom | Tur | Qiymat |
   |---|---|---|
   | `GROUP_ID` | Text (plain) | `-5293441607` |
   | `BOT_TOKEN` | Secret | `.env` dagi tokeningiz |
   | `WEBHOOK_SECRET` | Secret | `ec663c4055c1ed53d256e05e79632f3f6e2c0bda971dcfc1` |

5. Webhook ni ro'yxatdan o'tkazing — brauzerda oching:

   ```
   https://tgbot-video.<sizning-account>.workers.dev/setup?key=ec663c4055c1ed53d256e05e79632f3f6e2c0bda971dcfc1
   ```
   (URL worker sahifasida ko'rinadi — Workers → tgbot-video → **Settings → Domains & Routes**)

   Javobda `"ok": true` va `"pending_update_count": 0` bo'lishi kerak.

6. Telegram'da botga `/start` yuboring — javob kelishi kerak ✅

---

## Yo'l B — wrangler CLI orqali (avtomatik)

```powershell
cd C:\Users\Admin\Downloads\tgbot\worker
npm install                 # birinchi marta (wrangler o'rnatiladi)
npx wrangler login          # brauzerda Cloudflare hisobga kirish

# Sirlarni qo'ying (har birida so'raganda qiymatni kiriting):
npx wrangler secret put BOT_TOKEN        # .env dagi token
npx wrangler secret put WEBHOOK_SECRET   # ec663c4055c1ed53d256e05e79632f3f6e2c0bda971dcfc1

npx wrangler deploy         # worker ga yuklanadi
```

Keyin **Yo'l A ning 5-boshi**: `/setup?key=...` ni ochib webhook ni ulang.

---

## Boshqarish

| Amal | Buyruq / URL |
|---|---|
| Holat | Worker'ning `/` sahifasini oching |
| Webhook qayta ulash | `/setup?key=WEBHOOK_SECRET` |
| Webhook uzish | `/teardown?key=WEBHOOK_SECRET` |
| Jonli loglar | Dashboard → Worker → **Logs** |
| Kodni yangilash | Dashboard → Edit code → Deploy (yoki `npx wrangler deploy`) |
| O'chirish | Dashboard → Worker → Settings → Delete |

---

## Muhim eslatmalar

- **WEBHOOK_SECRET** — botni faqat sizga tegishli xabarlar qiziqtiradi:
  Telegram xabarlarni shu parol bilan yuboradi, boshqalar `403` oladi.
  Uni hech kimga bermang (xuddi `.env` kabi).
- `*.workers.dev` domeni ayrim tarmoqlarda blok bo'lsa — Dashboard →
  Worker → **Settings → Domains & Routes → Add custom domain** bilan
  o'z domeningizni ulang (masalan `bot.mening.uz`, Cloudflare'da bepul).
- Bepul plan oyiga **100 000 so'rov** beradi — kundalik foydalanish uchun
  ortiqcha. Worker **uxlamaydi**, ya'ni bot doimiy onlayn.
- Eski Python bot (`run.py`, `service.ps1`) o'z joyida qoladi — kerak
  bo'lsa qayta yoqish mumkin, lekin **ikkalasini bir vaqtda ishga
  tushirmang** (webhook/polling birga ishlamaydi).
- Xatolik bo'lsa: Dashboard → Worker → **Logs** da `Video guruhga
  yuborilmadi: ...` kabi yozuvlar chiqadi.

## Tez-tez uchraydigan xatolar

| Xatolik | Yechim |
|---|---|
| `missing_vars` | Settings → Variables and Secrets da BOT_TOKEN, GROUP_ID, WEBHOOK_SECRET qo'shilmagan |
| `forbidden` (403) | `/setup?key=` da noto'g'ri kalit — WEBHOOK_SECRET ni tekshiring |
| `Unauthorized` | BOT_TOKEN noto'g'ri yoki bekor qilingan — @BotFather dan yangi oling |
| `/start` javob bermaydi | Webhook ulanmagan — `/setup` ni qayta oching; lokal bot to'xtaganini tekshiring |
| `chat not found` | Bot guruhga qo'shilmagan yoki GROUP_ID noto'g'ri |
| Video guruhga bormaydi | Loglarni ko'ring: `not enough rights` bo'lsa guruhda video yuborish ruxsati bering |
