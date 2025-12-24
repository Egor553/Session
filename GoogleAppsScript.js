
/**
 * GOOGLE APPS SCRIPT BACKEND (V8)
 * Интеграция с Salebot.pro через персональный API Callback.
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SLOTS_SHEET = SS.getSheetByName("Слоты") || SS.insertSheet("Слоты");
const BOOKINGS_SHEET = SS.getSheetByName("Записи") || SS.insertSheet("Записи");

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
  let slotsData = e.parameter.slots;

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

    BOOKINGS_SHEET.appendRow([
      timestamp,
      type,
      city,
      slot,
      fullName,
      "'" + phone,
      externalId
    ]);

    if (SALEBOT_CALLBACK_URL && externalId) {
      try {
        const salebotPayload = {
          client_id: externalId,
          message: "mini_app_booking",
          name: fullName,
          phone: phone,
          city: city,
          booking_date: slot,
          booking_type: type
        };
        UrlFetchApp.fetch(SALEBOT_CALLBACK_URL, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(salebotPayload),
          muteHttpExceptions: true
        });
      } catch (err) {}
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Сохранение слотов
  if (action === "saveSlots" && slotsData) {
    SLOTS_SHEET.getRange("A1").setValue(JSON.stringify({ slots: JSON.parse(slotsData) }));
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}
