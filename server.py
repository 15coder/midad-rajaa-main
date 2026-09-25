import html
import json
import logging
import os
import re
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


HOST = "0.0.0.0"
PORT = 5000
ORDER_PATH = "/.netlify/functions/send-to-bot"
MAX_BODY_BYTES = 8192
MAX_FIELD_LENGTHS = {
    "name": 120,
    "phone": 32,
    "level": 80,
    "subject": 120,
    "orderType": 80,
    "deadline": 10,
    "notes": 1000,
}
ORDER_TYPES = {
    "ملخص",
    "عرض بوربوينت",
    "واجب",
    "بحث",
    "ملف إنجاز",
    "تصميم",
    "ترجمة",
    "سيرة ذاتية",
    "خدمة حاسب",
    "غير ذلك",
}


def json_response(handler, status, payload):
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


def validate_order(raw_body):
    if not raw_body or len(raw_body) > MAX_BODY_BYTES:
        return None, "الطلب فارغ أو حجمه أكبر من المسموح."

    try:
        order = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, "تعذر قراءة بيانات الطلب. أعد المحاولة."

    if not isinstance(order, dict):
        return None, "بيانات الطلب غير صالحة."

    normalized = {}
    for field, max_length in MAX_FIELD_LENGTHS.items():
        value = order.get(field, "")
        if value is None:
            value = ""
        if not isinstance(value, str):
            return None, "بعض بيانات الطلب غير صالحة."
        value = value.strip()
        if len(value) > max_length:
            return None, "أحد حقول الطلب أطول من المسموح."
        normalized[field] = value

    verification_code = order.get("verificationCode")
    if not isinstance(verification_code, str) or not re.fullmatch(
        r"[A-Z0-9]{8}", verification_code
    ):
        return None, "تعذر إنشاء رمز مطابقة صالح. أعد المحاولة."

    try:
        deadline = datetime.strptime(normalized["deadline"], "%Y-%m-%d").date()
        if deadline.isoformat() != normalized["deadline"]:
            raise ValueError
    except ValueError:
        deadline = None

    if (
        not normalized["name"]
        or not re.fullmatch(r"05\d{8}", re.sub(r"\s", "", normalized["phone"]))
        or not normalized["level"]
        or not normalized["subject"]
        or normalized["orderType"] not in ORDER_TYPES
        or deadline is None
    ):
        return None, "بيانات الطلب ناقصة أو غير صالحة. راجع الحقول وأعد المحاولة."

    normalized["verificationCode"] = verification_code
    return normalized, None


def escape(value):
    return html.escape(value, quote=True)


def build_telegram_message(order):
    received_at = datetime.now(ZoneInfo("Asia/Riyadh")).strftime("%Y/%m/%d %H:%M")
    lines = [
        "📚 <b>طلب جديد من متجر مداد</b>",
        "━━━━━━━━━━━━━━━━━━",
        f"🔐 <b>كود المطابقة:</b> <code>{escape(order['verificationCode'])}</code>",
        f"👤 <b>الاسم:</b> {escape(order['name'])}",
        f"📱 <b>الجوال:</b> {escape(order['phone'])}",
        f"🎓 <b>المرحلة:</b> {escape(order['level'])}",
        f"📖 <b>المادة:</b> {escape(order['subject'])}",
        f"📋 <b>نوع الطلب:</b> {escape(order['orderType'])}",
        f"📅 <b>موعد التسليم:</b> {escape(order['deadline'])}",
    ]
    if order["notes"]:
        lines.append(f"📝 <b>ملاحظات:</b> {escape(order['notes'])}")
    lines.extend(
        [
            "━━━━━━━━━━━━━━━━━━",
            f"⏰ <b>وقت الاستلام:</b> {escape(received_at)}",
        ]
    )
    return "\n".join(lines)


def send_order_to_telegram(order):
    bot_token = os.environ.get("MDAD_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("MDAD_CHAT_ID", "").strip()
    if not bot_token or not chat_id:
        missing = [
            key
            for key, value in (
                ("MDAD_BOT_TOKEN", bot_token),
                ("MDAD_CHAT_ID", chat_id),
            )
            if not value
        ]
        logging.error("Telegram order delivery is missing environment secrets: %s", ", ".join(missing))
        return 503, {
            "success": False,
            "message": "استقبال الطلبات غير مهيأ حاليًا. تواصل معنا مباشرة أو حاول لاحقًا.",
        }

    payload = json.dumps(
        {
            "chat_id": chat_id,
            "text": build_telegram_message(order),
            "parse_mode": "HTML",
            "protect_content": True,
        }
    ).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            telegram_data = json.loads(response.read().decode("utf-8"))
            status = response.status
    except HTTPError as error:
        status = error.code
        try:
            telegram_data = json.loads(error.read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            telegram_data = {}
    except (TimeoutError, URLError, OSError) as error:
        logging.error("Telegram order delivery failed: %s", type(error).__name__)
        return 502, {
            "success": False,
            "message": "تعذر الاتصال بتيليجرام لإرسال الطلب. أعد المحاولة بعد قليل.",
        }

    if status < 200 or status >= 300 or telegram_data.get("ok") is not True:
        logging.error(
            "Telegram rejected order delivery (HTTP %s): %s",
            status,
            telegram_data.get("description", "unknown error"),
        )
        return 502, {
            "success": False,
            "message": "تعذر إرسال الطلب إلى تيليجرام. لم تُفتح رسالة المتابعة؛ أعد المحاولة.",
        }

    return 200, {
        "success": True,
        "messageId": telegram_data.get("result", {}).get("message_id"),
    }


class MidadHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != ORDER_PATH:
            json_response(self, 404, {"success": False, "message": "المسار غير موجود."})
            return

        content_type = self.headers.get("Content-Type", "")
        if "application/json" not in content_type.lower():
            json_response(
                self,
                415,
                {"success": False, "message": "صيغة الطلب غير مدعومة."},
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            json_response(
                self,
                400,
                {"success": False, "message": "الطلب فارغ أو حجمه أكبر من المسموح."},
            )
            return

        order, error = validate_order(self.rfile.read(content_length))
        if error:
            json_response(self, 400, {"success": False, "message": error})
            return

        status, result = send_order_to_telegram(order)
        json_response(self, status, result)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    server = ThreadingHTTPServer((HOST, PORT), MidadHandler)
    logging.info("Serving Midad on %s:%s", HOST, PORT)
    server.serve_forever()