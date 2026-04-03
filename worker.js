export default {
  async fetch(request, env, ctx) {
    // Hanya menerima request POST dari Telegram Webhook
    if (request.method !== "POST") {
      return new Response("Bot is running!", { status: 200 });
    }

    try {
      const update = await request.json();

      // Jika ada pesan masuk
      if (update.message && update.message.text) {
        await handleMessage(update.message, env);
      }

      // Selalu kembalikan status 200 OK ke Telegram agar tidak dikirim ulang
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error(error);
      return new Response("Error", { status: 200 });
    }
  }
};

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const text = message.text.trim();

  // 1. Command /start
  if (text === "/start") {
    const welcomeText = "📱 *Bot Cek Kuota*\n\nSilahkan kirim nomor HP.\nContoh:\n`08123456789`";
    await sendMessage(chatId, welcomeText, env.BOT_TOKEN, "Markdown");
    return;
  }

  // 2. Validasi Nomor (Harus angka)
  if (!/^\d+$/.test(text)) {
    await sendMessage(chatId, "❌ Kirim nomor yang valid.", env.BOT_TOKEN);
    return;
  }

  let msisdn = text;
  if (msisdn.startsWith("08")) {
    msisdn = "62" + msisdn.substring(1);
  }

  // 3. Kirim Pesan Loading
  const waitMsgRes = await sendMessage(chatId, "⏳ Mengecek kuota...", env.BOT_TOKEN);
  const waitMsgData = await waitMsgRes.json();
  
  if (!waitMsgData.ok) return; // Jika gagal kirim pesan, hentikan
  const messageId = waitMsgData.result.message_id;

  // 4. Hit API Eksternal
  try {
    const apiUrl = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${msisdn}&isJSON=true`;
    const headers = {
      "Authorization": "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
      "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
      "X-App-Version": "4.0.0"
    };

    const response = await fetch(apiUrl, { headers });
    const resJSON = await response.json();

    if (!resJSON.status) {
      await editMessageText(chatId, messageId, "❌ Gagal cek kuota.", env.BOT_TOKEN);
      return;
    }

    // Ekstrak Data
    const data = resJSON.data || {};
    const data_sp = data.data_sp || {};
    const operator = data_sp.prefix?.value || "-";
    const active = data_sp.active_period?.value || "-";
    const grace = data_sp.grace_period?.value || "-";

    let finalMsg = `📱 Nomor: ${msisdn}\n📡 Operator: ${operator}\n📆 Masa Aktif: ${active}\n⏳ Masa Tenggang: ${grace}\n\n📊 Kuota:\n`;

    let hasil = data.hasil;
    if (hasil) {
      // Replace all <br> dan = menggunakan method JS modern
      hasil = hasil.replaceAll("<br>", "\n").replaceAll("=", "").trim();
      finalMsg += hasil;
    } else {
      finalMsg += "Tidak ada info kuota.";
    }

    finalMsg += "\n\n⚠️ Jika bot bermasalah hubungi @tokopandaid";

    // 5. Edit Pesan Loading menjadi Hasil Akhir
    await editMessageText(chatId, messageId, finalMsg, env.BOT_TOKEN);

  } catch (error) {
    console.error(error);
    await editMessageText(chatId, messageId, "❌ Error koneksi server.", env.BOT_TOKEN);
  }
}

// ==========================================
// Helper Functions untuk Telegram API
// ==========================================

async function sendMessage(chatId, text, token, parseMode = null) {
  const body = {
    chat_id: chatId,
    text: text
  };
  if (parseMode) {
    body.parse_mode = parseMode;
  }
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function editMessageText(chatId, messageId, text, token) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text
  };
  return fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
