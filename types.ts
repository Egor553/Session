
export type SlotMap = {
  [city: string]: string[]; // ISO Strings
};

export interface BookingData {
  type: 'Online' | 'Offline';
  city: string;
  slot: string; // Formatted date string
  full_name: string;
  phone: string;
  external_id?: string; // ID клиента из Salebot/Telegram
}

export enum Screen {
  CITY_SELECT = 'CITY_SELECT',
  CALENDAR = 'CALENDAR',
  BOOKING_FORM = 'BOOKING_FORM',
  ADMIN = 'ADMIN',
}

export interface WebAppTheme {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
          start_param?: string; // Параметр из ссылки вида t.me/bot?startapp=123
        };
        themeParams: WebAppTheme;
        ready: () => void;
        close: () => void;
        sendData: (data: string) => void;
        expand: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
          enable: () => void;
          disable: () => void;
        };
        // Fix: Added HapticFeedback definition to WebApp interface
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}