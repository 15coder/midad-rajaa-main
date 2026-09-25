const { randomBytes } = require('node:crypto');

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

function getRequestBody(event) {
  if (!event.body) return '';
  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
}

function normalizeField(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function readAndValidateOrder(event) {
  const body = getRequestBody(event);
  if (!body || Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    return { error: 'الطلب فارغ أو حجمه أكبر من المسموح.' };
  }

  let order;
  try {
    order = JSON.parse(body);
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

    normalized[field] = normalizeField(value);
    if (normalized[field].length > maxLength) {
      return { error: 'أحد حقول الطلب أطول من المسموح.' };
    }
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

  return { order: normalized };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function generateVerificationCode() {
  return `#MD-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function buildOrderMessage(order, verificationCode) {
  return [
    '📚 طلب جديد من متجر مداد',
    '',
    `🔐 كود المطابقة: ${verificationCode}`,
    '',
    `👤 الاسم: ${order.name}`,
    `📱 الجوال: ${order.phone}`,
    `🎓 المرحلة الدراسية: ${order.level}`,
    `📖 المادة: ${order.subject}`,
    `📋 نوع الطلب: ${order.orderType}`,
    `📅 موعد التسليم: ${order.deadline}`,
    `📝 ملاحظات: ${order.notes}`,
    '',
    'السلام عليكم ورحمة الله وبركاته، رَجــــاءً أكِّدوا استلام الطلب وزوّدونا ببيانات الدفع لنبدأ بالتنفيذ',
  ].join('\n');
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

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) {
    const missing = [
      !botToken && 'TELEGRAM_BOT_TOKEN',
      !chatId && 'TELEGRAM_CHAT_ID',
    ].filter(Boolean);
    console.error('Telegram order delivery is missing Netlify variables:', missing.join(', '));
    return jsonResponse(503, {
      success: false,
      message: 'استقبال الطلبات غير مهيأ حاليًا. حاول لاحقًا أو تواصل معنا مباشرة.',
    });
  }

  const verificationCode = generateVerificationCode();
  const message = buildOrderMessage(order, verificationCode);

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
        protect_content: true,
      }),
    });

    const telegramData = await telegramResponse.json().catch(() => null);
    if (!telegramResponse.ok || telegramData?.ok !== true) {
      console.error('Telegram rejected order delivery:', {
        httpStatus: telegramResponse.status,
        errorCode: telegramData?.error_code || null,
        description: telegramData?.description || 'unknown error',
      });
      return jsonResponse(502, {
        success: false,
        message: 'تعذر تسجيل الطلب لدى الإدارة عبر تيليجرام. أعد المحاولة بعد قليل.',
      });
    }

    return jsonResponse(200, {
      success: true,
      verificationCode,
    });
  } catch (error) {
    console.error('Telegram order delivery failed:', error.name || 'Unknown error');
    return jsonResponse(502, {
      success: false,
      message: 'تعذر الاتصال بتيليجرام لإرسال الطلب. أعد المحاولة بعد قليل.',
    });
  }
};