
/**
 * GOOGLE APPS SCRIPT BACKEND (V8)
 * Интеграция с Salebot.pro через персональный API Callback.
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SLOTS_SHEET = SS.getSheetByName("Слоты") || SS.insertSheet("Слоты");
const BOOKINGS_SHEET = SS.getSheetByName("Записи") || SS.insertSheet("Записи");

/**
 * URL, предоставленный поддержкой Salebot.
 */
const SALEBOT_CALLBACK_URL = "https://chatter.salebot.pro/api/d3f31dabef80ddeb73d43938b4ef8bb0/callback";

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getSlots") {
    const range = SLOTS_SHEET.getRange("A1");
    const rawJson = range.getValue();
    let data = { slots: {} };
    try {
      if (rawJson) data = JSON.parse(rawJson);
    } catch (err) {}
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  let action = e.parameter.action;
  let payload = null;

  if (e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
      if (!action && payload.action) action = payload.action;
    } catch (err) {}
  }

  // 1. Создание записи
  if (action === "createBooking") {
    const p = e.parameter;
    const timestamp = new Date();
    const phone = p.phone || "";
    const fullName = p.full_name || "";
    const city = p.city || "";
    const slot = p.slot || "";
    const type = p.type || "Offline";
    const externalId = p.external_id || ""; 

    // Запись в Google Таблицу
    BOOKINGS_SHEET.appendRow([
      timestamp,
      type,
      city,
      slot,
      fullName,
      "'" + phone,
      externalId
    ]);

    // ОТПРАВКА В SALEBOT
    if (SALEBOT_CALLBACK_URL && externalId) {
      try {
        const salebotPayload = {
          client_id: externalId,         // ID клиента для связи
          message: "mini_app_booking",   // Фраза-триггер для Salebot (создайте блок с этим условием)
          
          // Эти поля Salebot автоматически сохранит как переменные клиента
          name: fullName,                // Переменная #{name}
          phone: phone,                  // Переменная #{phone}
          city: city,                    // Переменная #{city}
          booking_date: slot,            // Переменная #{booking_date}
          booking_type: type             // Переменная #{booking_type}
        };

        const options = {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(salebotPayload),
          muteHttpExceptions: true
        };

        // Делаем запрос к Salebot
        UrlFetchApp.fetch(SALEBOT_CALLBACK_URL, options);
      } catch (err) {
        console.error("Salebot API Error: " + err);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Сохранение слотов
  if (action === "saveSlots" && payload) {
    SLOTS_SHEET.getRange("A1").setValue(JSON.stringify({ slots: payload.slots }));
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}
