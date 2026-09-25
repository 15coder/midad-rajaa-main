exports.handler = async (event, context) => {
  // السماح فقط بـ POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const orderData = JSON.parse(event.body);

    // الحصول على بيانات البوت من environment variables
    const botToken = process.env.MDAD_BOT_TOKEN;
    const chatId = process.env.MDAD_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Missing bot configuration');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Configuration error' })
      };
    }

    // بناء الرسالة
    const message = `
🔐 *طلب جديد - نظام التحقق*
═══════════════════════════════════
📌 *كود المطابقة:* \`${orderData.verificationCode}\`
─────────────────────────────────────
👤 *الاسم:* ${orderData.name}
📱 *الجوال:* ${orderData.phone}
🎓 *المرحلة:* ${orderData.level}
📖 *المادة:* ${orderData.subject}
📋 *نوع الطلب:* ${orderData.orderType}
📅 *الموعد:* ${orderData.deadline}
${orderData.notes ? `📝 *ملاحظات:* ${orderData.notes}` : ''}
═══════════════════════════════════
⏰ الوقت: ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
🔒 تم التشفير والإرسال بأمان
🌐 IP: ${event.headers['x-forwarded-for'] || 'Unknown'}`;

    // إرسال الرسالة إلى Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          protect_content: true, // حماية المحتوى من النسخ
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API error:', telegramData);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send message' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        messageId: telegramData.result.message_id
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
