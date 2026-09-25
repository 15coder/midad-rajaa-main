const MAX_BODY_BYTES = 8192;
const MAX_FIELD_LENGTHS = {
  name: 120,
  phone: 32,
  level: 80,
  subject: 120,
  orderType: 80,
  deadline: 10,
  notes: 1000,
};
const ORDER_TYPES = new Set([
  'ملخص',
  'عرض بوربوينت',
  'واجب',
  'بحث',
  'ملف إنجاز',
  'تصميم',
  'ترجمة',
  'سيرة ذاتية',
  'خدمة حاسب',
  'غير ذلك',
]);

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readAndValidateOrder(event) {
  if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return { error: 'الطلب فارغ أو حجمه أكبر من المسموح.' };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { error: 'تعذر قراءة بيانات الطلب. أعد المحاولة.' };
  }

  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return { error: 'بيانات الطلب غير صالحة.' };
  }

  const normalized = {};
  for (const [field, maxLength] of Object.entries(MAX_FIELD_LENGTHS)) {
    const value = order[field] == null ? '' : order[field];
    if (typeof value !== 'string') {
      return { error: 'بعض بيانات الطلب غير صالحة.' };
    }
    normalized[field] = value.trim();
    if (normalized[field].length > maxLength) {
      return { error: 'أحد حقول الطلب أطول من المسموح.' };
    }
  }

  const verificationCode = order.verificationCode;
  if (typeof verificationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(verificationCode)) {
    return { error: 'تعذر إنشاء رمز مطابقة صالح. أعد المحاولة.' };
  }

  if (
    !normalized.name ||
    !/^05\d{8}$/.test(normalized.phone.replace(/\s/g, '')) ||
    !normalized.level ||
    !normalized.subject ||
    !ORDER_TYPES.has(normalized.orderType) ||
    !isValidDate(normalized.deadline)
  ) {
    return { error: 'بيانات الطلب ناقصة أو غير صالحة. راجع الحقول وأعد المحاولة.' };
  }

  return { order: { ...normalized, verificationCode } };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function buildMessage(order) {
  const date = new Date().toLocaleString('ar-SA', {
    timeZone: 'Asia/Riyadh',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const lines = [
    '📚 <b>طلب جديد من متجر مداد</b>',
    '━━━━━━━━━━━━━━━━━━',
    `🔐 <b>كود المطابقة:</b> <code>${order.verificationCode}</code>`,
    `👤 <b>الاسم:</b> ${escapeHtml(order.name)}`,
    `📱 <b>الجوال:</b> ${escapeHtml(order.phone)}`,
    `🎓 <b>المرحلة:</b> ${escapeHtml(order.level)}`,
    `📖 <b>المادة:</b> ${escapeHtml(order.subject)}`,
    `📋 <b>نوع الطلب:</b> ${escapeHtml(order.orderType)}`,
    `📅 <b>موعد التسليم:</b> ${escapeHtml(order.deadline)}`,
  ];

  if (order.notes) lines.push(`📝 <b>ملاحظات:</b> ${escapeHtml(order.notes)}`);
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push(`⏰ <b>وقت الاستلام:</b> ${escapeHtml(date)}`);
  return lines.join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, {
      success: false,
      message: 'طريقة الطلب غير مسموحة.',
    });
  }

  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(415, {
      success: false,
      message: 'صيغة الطلب غير مدعومة.',
    });
  }

  const { order, error } = readAndValidateOrder(event);
  if (error) {
    return jsonResponse(400, { success: false, message: error });
  }

  const botToken = process.env.MDAD_BOT_TOKEN?.trim();
  const chatId = process.env.MDAD_CHAT_ID?.trim();
  if (!botToken || !chatId) {
    console.error('Telegram order delivery is missing its Netlify environment configuration.');
    return jsonResponse(503, {
      success: false,
      message: 'استقبال الطلبات غير مهيأ حاليًا. تواصل معنا مباشرة أو حاول لاحقًا.',
    });
  }

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(order),
        parse_mode: 'HTML',
        protect_content: true,
      }),
    });

    const telegramData = await telegramResponse.json().catch(() => null);
    if (!telegramResponse.ok || telegramData?.ok !== true) {
      console.error('Telegram rejected order delivery:', telegramData?.description || telegramResponse.status);
      return jsonResponse(502, {
        success: false,
        message: 'تعذر إرسال الطلب إلى تيليجرام. لم تُفتح رسالة المتابعة؛ أعد المحاولة.',
      });
    }

    return jsonResponse(200, {
      success: true,
      messageId: telegramData.result.message_id,
    });
  } catch (error) {
    console.error('Telegram order delivery failed:', error.name || 'Unknown error');
    return jsonResponse(502, {
      success: false,
      message: 'تعذر الاتصال بتيليجرام لإرسال الطلب. أعد المحاولة بعد قليل.',
    });
  }
};
