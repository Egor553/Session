import { SlotMap, BookingData } from '../types';

/**
 * URL вашего развернутого Google Apps Script.
 */
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJQ1omQEi6ZDm7FIVG_NGkRcFaNFxR7NzFxY0_5GtHdhsaIdDaCDn2z5IqDBvk7GXqUw/exec';

export const getSlots = async (): Promise<SlotMap> => {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getSlots`, {
      method: 'GET',
      mode: 'cors'
    });
    if (!response.ok) throw new Error('Ошибка сети при получении слотов');
    const data = await response.json();
    return data.slots || {};
  } catch (error) {
    console.error('Failed to fetch slots:', error);
    return {};
  }
};

export const saveSlots = async (slots: SlotMap): Promise<boolean> => {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=saveSlots`, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ slots, action: 'saveSlots' }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to save slots:', error);
    return false;
  }
};

export const createBooking = async (booking: BookingData): Promise<boolean> => {
  try {
    const params = new URLSearchParams();
    params.append('action', 'createBooking');
    Object.entries(booking).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      body: params,
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to create booking:', error);
    return false;
  }
};