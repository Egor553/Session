import React, { useState, useEffect, useMemo } from 'react';
import { Screen, SlotMap, BookingData } from './types';
import { getSlots, saveSlots, createBooking } from './services/api';

const Spinner = ({ size = 'md', color = 'blue' }: { size?: 'sm' | 'md' | 'lg', color?: string }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4'
  };
  const colorClass = color === 'blue' ? 'border-blue-500/20 border-t-blue-500' : 'border-white/20 border-t-white';
  return (
    <div className="flex justify-center items-center">
      <div className={`${sizes[size]} ${colorClass} rounded-full animate-spinner`}></div>
    </div>
  );
};

const Header = ({ title, onBack }: { title: string; onBack?: () => void }) => (
  <header className="px-6 py-5 flex items-center bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
    {onBack && (
      <button onClick={onBack} className="mr-4 p-2 -ml-2 text-gray-400 active:scale-90 transition-transform" type="button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    )}
    <h1 className="text-xl font-black text-gray-900 tracking-tight truncate">{title}</h1>
  </header>
);

const CalendarGrid = ({ availableDates, selectedDate, onDateSelect }: { 
  availableDates: string[], 
  selectedDate: string | null, 
  onDateSelect: (date: string) => void 
}) => {
  const [viewDate, setViewDate] = useState(new Date());
  
  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isAvailable = (day: number) => {
    const d = new Date(year, month, day).toDateString();
    return availableDates.includes(d);
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return new Date(year, month, day).toDateString() === selectedDate;
  };

  const gridDays = [];
  for (let i = 0; i < offset; i++) gridDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) gridDays.push(i);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-black text-lg text-gray-900">{monthNames[month]} {year}</h3>
        <div className="flex space-x-2">
          <button onClick={prevMonth} className="p-2 bg-gray-50 rounded-xl text-gray-400 active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={nextMonth} className="p-2 bg-gray-50 rounded-xl text-gray-400 active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysOfWeek.map(d => (
          <div key={d} className="text-center text-[10px] font-black text-gray-300 uppercase py-2">{d}</div>
        ))}
        {gridDays.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const available = isAvailable(day);
          const selected = isSelected(day);
          
          return (
            <button
              key={day}
              disabled={!available}
              onClick={() => onDateSelect(new Date(year, month, day).toDateString())}
              className={`
                relative aspect-square flex flex-col items-center justify-center rounded-2xl text-sm font-bold transition-all
                ${selected ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 z-10 scale-110' : 
                  available ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'text-gray-200'}
              `}
            >
              {day}
              {available && !selected && <div className="absolute bottom-2 w-1 h-1 bg-blue-400 rounded-full"></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.CITY_SELECT);
  const [allSlots, setAllSlots] = useState<SlotMap>({});
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [cityInput, setCityInput] = useState('');
  const [cityChecked, setCityChecked] = useState(false);
  const [matchedCity, setMatchedCity] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: '', phone: '' });

  const [adminConfig, setAdminConfig] = useState({
    type: 'Offline',
    city: '',
    startDate: '',
    endDate: '',
    startTime: '10:00',
    endTime: '18:00',
    interval: 60
  });

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.themeParams?.bg_color) {
        document.body.style.backgroundColor = tg.themeParams.bg_color;
      }
    }
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSlots();
      setAllSlots(data || {});
    } catch (err: any) {
      console.error("Fetch initial data error:", err);
      setError("Не удалось загрузить данные. Проверьте интернет.");
    } finally {
      setLoading(false);
    }
  };

  const checkCity = () => {
    const input = cityInput.trim();
    if (!input) return;

    if (input.toLowerCase() === 'admin123') {
      setCurrentScreen(Screen.ADMIN);
      return;
    }

    const cityKey = Object.keys(allSlots).find(k => k.toLowerCase() === input.toLowerCase() && k !== 'online');
    setMatchedCity(cityKey || null);
    setCityChecked(true);
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  };

  const availableDatesList = useMemo(() => {
    if (!selectedCity || !allSlots[selectedCity]) return [];
    const dates = allSlots[selectedCity].map((s: string) => new Date(s).toDateString());
    return Array.from(new Set(dates));
  }, [selectedCity, allSlots]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedCity || !selectedDate || !allSlots[selectedCity]) return [];
    return allSlots[selectedCity]
      .filter((s: string) => new Date(s).toDateString() === selectedDate)
      .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
  }, [selectedCity, selectedDate, allSlots]);

  const handleBooking = async () => {
    if (!selectedCity || !selectedSlot || !formData.name || !formData.phone) return;
    setActionLoading(true);
    
    const dateObj = new Date(selectedSlot);
    const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    const externalId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || "";

    const bookingPayload: BookingData = {
      type: selectedCity === 'online' ? 'Online' : 'Offline',
      city: selectedCity === 'online' ? 'Онлайн' : selectedCity,
      slot: formattedDate,
      full_name: formData.name,
      phone: formData.phone,
      external_id: externalId
    };

    try {
      const success = await createBooking(bookingPayload);
      if (success) {
        const updatedCitySlots = (allSlots[selectedCity] || []).filter(s => s !== selectedSlot);
        const updatedAllSlots = { ...allSlots, [selectedCity]: updatedCitySlots };
        await saveSlots(updatedAllSlots);
        setIsSuccess(true);
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        // Removed automatic close to allow user to see the success button
      } else {
        throw new Error('Booking failed');
      }
    } catch (err) {
      alert('Ошибка при сохранении записи.');
    } finally {
      setActionLoading(false);
    }
  };

  const generateAdminSlots = async () => {
    if (!adminConfig.startDate || !adminConfig.endDate || (!adminConfig.city && adminConfig.type === 'Offline')) {
      alert('Заполните все поля');
      return;
    }
    setActionLoading(true);
    const generated: string[] = [];
    const start = new Date(adminConfig.startDate);
    const end = new Date(adminConfig.endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const [sh, sm] = adminConfig.startTime.split(':').map(Number);
      const [eh, em] = adminConfig.endTime.split(':').map(Number);
      
      let current = new Date(d);
      current.setHours(sh, sm, 0, 0);
      const limit = new Date(d);
      limit.setHours(eh, em, 0, 0);

      while (current <= limit) {
        generated.push(current.toISOString());
        current = new Date(current.getTime() + adminConfig.interval * 60000);
      }
    }

    const cityKey = adminConfig.type === 'Online' ? 'online' : adminConfig.city.trim();
    const updatedAllSlots = { ...allSlots, [cityKey]: [...(allSlots[cityKey] || []), ...generated] };
    
    const success = await saveSlots(updatedAllSlots);
    if (success) {
      setAllSlots(updatedAllSlots);
      alert('Слоты успешно добавлены!');
      setCurrentScreen(Screen.CITY_SELECT);
    }
    setActionLoading(false);
  };

  if (loading && Object.keys(allSlots).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-white">
        <div className="relative mb-6">
          <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-500 shadow-inner pulse">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="absolute -bottom-2 -right-2">
             <Spinner size="md" />
          </div>
        </div>
        <h2 className="text-xl font-black text-gray-900 tracking-tight">Загрузка...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-white space-y-6">
        <div className="text-red-500 bg-red-50 p-6 rounded-full">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p className="text-gray-900 font-bold">{error}</p>
        <button onClick={fetchInitialData} className="px-8 py-3 bg-blue-500 text-white rounded-2xl font-black">Повторить</button>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-white space-y-8 animate-fade-in">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 bg-green-500 rounded-[2.5rem] flex items-center justify-center text-white shadow-xl animate-bounce">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Вы записаны!</h2>
          <p className="text-gray-500 font-bold max-w-[240px]">Ожидайте сообщения с подтверждением в боте.</p>
        </div>
        
        <button 
          onClick={() => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
              window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
            window.Telegram?.WebApp?.close();
          }}
          className="w-full max-w-xs py-5 rounded-3xl bg-blue-500 text-white font-black text-xl shadow-xl shadow-blue-100 active:scale-95 transition-all"
        >
          Завершить
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white font-sans animate-fade-in flex flex-col">
      {currentScreen === Screen.CITY_SELECT && (
        <div className="p-8 flex flex-col items-center justify-center flex-1 space-y-10">
          <div className="text-center space-y-4">
            <div className="inline-flex p-6 bg-blue-50 rounded-[2.5rem] text-blue-500 mb-2 shadow-inner">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-gray-900">Запись на сессию</h1>
          </div>

          <div className="w-full space-y-6">
            {!cityChecked ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Ваш город..."
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  className="w-full p-6 rounded-3xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-black text-center text-xl transition-all"
                />
                <button
                  onClick={checkCity}
                  disabled={!cityInput.trim() || actionLoading}
                  className="w-full py-5 rounded-3xl bg-blue-500 text-white font-black text-xl shadow-xl active:scale-95 transition-all"
                >
                  {actionLoading ? <Spinner color="white" /> : 'Найти окна'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {matchedCity ? (
                  <button
                    onClick={() => { setSelectedCity(matchedCity); setCurrentScreen(Screen.CALENDAR); }}
                    className="w-full p-6 rounded-[2rem] bg-white border-2 border-blue-500 text-blue-600 font-black flex items-center justify-between active:scale-95 shadow-sm"
                  >
                    <span>📍 {matchedCity}</span>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                ) : (
                  <div className="p-6 rounded-3xl bg-amber-50 text-amber-700 font-bold text-center border border-amber-100">
                    В "{cityInput}" пока нет встреч.
                  </div>
                )}
                <button
                  onClick={() => { setSelectedCity('online'); setCurrentScreen(Screen.CALENDAR); }}
                  className="w-full p-6 rounded-[2rem] bg-blue-500 text-white font-black flex items-center justify-between shadow-xl active:scale-95"
                >
                  <span>🌐 Онлайн сессия</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <button onClick={() => setCityChecked(false)} className="w-full py-4 text-gray-400 font-black text-xs uppercase tracking-widest text-center">
                  Сменить город
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {currentScreen === Screen.CALENDAR && (
        <div className="flex flex-col min-h-screen">
          <Header title="Выберите день" onBack={() => setCurrentScreen(Screen.CITY_SELECT)} />
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <CalendarGrid 
              availableDates={availableDatesList}
              selectedDate={selectedDate}
              onDateSelect={(d) => {
                setSelectedDate(d);
                setSelectedSlot(null);
                if (window.Telegram?.WebApp?.HapticFeedback) {
                  window.Telegram.WebApp.HapticFeedback.selectionChanged();
                }
              }}
            />

            {selectedDate && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Доступное время</h3>
                <div className="grid grid-cols-3 gap-3">
                  {slotsForSelectedDate.map(slot => (
                    <button
                      key={slot}
                      onClick={() => {
                        setSelectedSlot(slot);
                        if (window.Telegram?.WebApp?.HapticFeedback) {
                          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                        }
                      }}
                      className={`py-5 rounded-2xl border-2 transition-all font-black text-lg ${
                        selectedSlot === slot ? 'border-blue-500 bg-blue-500 text-white shadow-lg scale-95' : 'border-gray-50 bg-gray-50 text-gray-700'
                      }`}
                    >
                      {new Date(slot).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {selectedSlot && (
            <div className="p-6 border-t border-gray-100 bg-white/90 backdrop-blur-md sticky bottom-0">
              <button
                onClick={() => setCurrentScreen(Screen.BOOKING_FORM)}
                className="w-full py-5 rounded-2xl bg-blue-500 text-white font-black text-xl shadow-xl active:scale-95 transition-all"
              >
                Продолжить
              </button>
            </div>
          )}
        </div>
      )}

      {currentScreen === Screen.BOOKING_FORM && (
        <div className="flex flex-col min-h-screen">
          <Header title="Контактные данные" onBack={() => setCurrentScreen(Screen.CALENDAR)} />
          <div className="p-8 space-y-8 flex-1">
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 shadow-inner">
              <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Вы записываетесь на:</div>
              <div className="text-blue-900 font-black text-xl">
                {selectedCity === 'online' ? '🌐 Онлайн' : `📍 ${selectedCity}`}
              </div>
              <div className="text-blue-700 font-bold text-lg mt-1">
                {selectedSlot && new Date(selectedSlot).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Ваше имя</label>
                <input
                  type="text"
                  placeholder="Имя Фамилия"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-black text-lg transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Номер телефона</label>
                <input
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-black text-lg transition-all"
                />
              </div>
            </div>
          </div>
          <div className="p-6">
            <button
              onClick={handleBooking}
              disabled={actionLoading || !formData.name || !formData.phone}
              className="w-full py-6 rounded-3xl bg-blue-600 text-white font-black text-xl shadow-xl disabled:opacity-50"
            >
              {actionLoading ? <Spinner color="white" /> : 'Записаться'}
            </button>
          </div>
        </div>
      )}

      {currentScreen === Screen.ADMIN && (
        <div className="min-h-screen bg-gray-50 pb-10 flex flex-col">
          <Header title="Админ-панель" onBack={() => setCurrentScreen(Screen.CITY_SELECT)} />
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm space-y-6">
              <h3 className="text-xl font-black text-gray-900 px-1">Генератор слотов</h3>
              <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button 
                  onClick={() => setAdminConfig({...adminConfig, type: 'Offline'})}
                  className={`flex-1 py-4 rounded-xl font-black text-sm transition-all ${adminConfig.type === 'Offline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                >📍 Оффлайн</button>
                <button 
                  onClick={() => setAdminConfig({...adminConfig, type: 'Online'})}
                  className={`flex-1 py-4 rounded-xl font-black text-sm transition-all ${adminConfig.type === 'Online' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                >🌐 Онлайн</button>
              </div>

              {adminConfig.type === 'Offline' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Город</label>
                  <input
                    type="text"
                    placeholder="Напр. Астана"
                    value={adminConfig.city}
                    onChange={(e) => setAdminConfig({...adminConfig, city: e.target.value})}
                    className="w-full p-5 bg-gray-50 rounded-2xl font-black outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Начало</label>
                  <input type="date" value={adminConfig.startDate} onChange={(e) => setAdminConfig({...adminConfig, startDate: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold border-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Конец</label>
                  <input type="date" value={adminConfig.endDate} onChange={(e) => setAdminConfig({...adminConfig, endDate: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold border-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Время от</label>
                  <input type="time" value={adminConfig.startTime} onChange={(e) => setAdminConfig({...adminConfig, startTime: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold border-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Время до</label>
                  <input type="time" value={adminConfig.endTime} onChange={(e) => setAdminConfig({...adminConfig, endTime: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold border-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Интервал (мин)</label>
                <input type="number" value={adminConfig.interval} onChange={(e) => setAdminConfig({...adminConfig, interval: parseInt(e.target.value) || 60})} className="w-full p-5 bg-gray-50 rounded-2xl font-black border-none" />
              </div>

              <button
                onClick={generateAdminSlots}
                disabled={actionLoading}
                className="w-full py-6 rounded-3xl bg-black text-white font-black text-lg shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                {actionLoading ? <Spinner color="white" /> : 'Сгенерировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;