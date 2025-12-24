
import { SlotMap, BookingData } from '../types';

/**
 * URL вашего развернутого Google Apps Script.
 */
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6zpr4AzXerGEvDTDrBqjHayMYTXn2-8TECSWsBmfNGqnMOeTvSqVD8fh8N-DGtXTKcw/exec';

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 30000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const getSlots = async (): Promise<SlotMap> => {
  try {
    const response = await fetchWithTimeout(`${SCRIPT_URL}?action=getSlots`, {
      method: 'GET',
      mode: 'cors'
    });
    if (!response.ok) throw new Error('Ошибка сети при получении слотов');
    const data = await response.json();
    return data.slots || {};
  } catch (error) {
    console.error('Failed to fetch slots:', error);
    throw error;
  }
};

export const saveSlots = async (slots: SlotMap): Promise<boolean> => {
  try {
    const params = new URLSearchParams();
    params.append('action', 'saveSlots');
    params.append('slots', JSON.stringify(slots));

    const response = await fetchWithTimeout(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      body: params,
    });
    const result = await response.json();
    return result.success === true;
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

    const response = await fetchWithTimeout(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      body: params,
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Failed to create booking:', error);
    return false;
  }
};
