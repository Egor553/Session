
import React, { useState, useEffect, useMemo } from 'react';
import { Screen, SlotMap } from './types';
import { getSlots, saveSlots, createBooking } from './services/api';

const Spinner = ({ size = 'md', color = 'blue' }: { size?: 'sm' | 'md' | 'lg', color?: string }) => {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-4', lg: 'w-12 h-12 border-4' };
  const colorClass = color === 'blue' ? 'border-blue-500/20 border-t-blue-500' : 'border-white/20 border-t-white';
  return <div className={`${sizes[size]} ${colorClass} rounded-full animate-spin mx-auto`}></div>;
};

const Header = ({ title, onBack, rightElement }: { title: string; onBack?: () => void; rightElement?: React.ReactNode }) => (
  <header className="px-6 py-4 flex items-center justify-between bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
    <div className="flex items-center overflow-hidden">
      {onBack && (
        <button onClick={onBack} className="mr-3 p-2 -ml-2 text-gray-900 active:scale-90 transition-transform">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      <h1 className="text-lg font-black text-gray-900 tracking-tight truncate">{title}</h1>
    </div>
    {rightElement}
  </header>
);

const getDaysInMonth = (month: number, year: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.CITY_SELECT);
  const [allSlots, setAllSlots] = useState<SlotMap>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [adminTab, setAdminTab] = useState<'create' | 'list'>('create');
  
  const [cityInput, setCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });

  const [viewingMonth, setViewingMonth] = useState(new Date());
  const [adminRange, setAdminRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });

  const [adminConfig, setAdminConfig] = useState({
    type: 'Offline',
    city: '',
    startTime: '10:00',
    endTime: '18:00',
    interval: 60
  });

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getSlots();
      setAllSlots(data || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCitySearch = () => {
    const input = cityInput.trim();
    if (input.toLowerCase() === 'admin123') {
      setCurrentScreen(Screen.ADMIN);
      return;
    }
    
    const foundCity = Object.keys(allSlots).find(k => k.toLowerCase() === input.toLowerCase() && k !== 'online');
    if (foundCity && (allSlots[foundCity] || []).length > 0) {
      setSelectedCity(foundCity);
      setIsOfflineAvailable(true);
    } else {
      setSelectedCity('');
      setIsOfflineAvailable(false);
    }
    setCurrentScreen(Screen.CITY_RESULT);
  };

  const selectSessionType = (type: 'online' | 'offline') => {
    const cityKey = type === 'online' ? 'online' : (selectedCity || '');
    setSelectedCity(cityKey);
    setSelectedDate(null);
    setSelectedSlot(null);
    setCurrentScreen(Screen.CALENDAR);
  };

  const handleBooking = async () => {
    if (!selectedSlot || !formData.name || !formData.phone) return;
    setActionLoading(true);
    const d = new Date(selectedSlot);
    const formatted = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    
    const ok = await createBooking({
      type: selectedCity === 'online' ? 'Online' : 'Offline',
      city: selectedCity === 'online' ? 'Онлайн' : selectedCity,
      slot: formatted,
      full_name: formData.name,
      phone: formData.phone,
      external_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || ''
    });

    if (ok) {
      const updated = { ...allSlots, [selectedCity]: (allSlots[selectedCity] || []).filter(s => s !== selectedSlot) };
      saveSlots(updated).catch(console.error);
      setAllSlots(updated);
      setIsSuccess(true);
    } else {
      window.Telegram?.WebApp?.showAlert("Ошибка записи. Пожалуйста, попробуйте еще раз.");
    }
    setActionLoading(false);
  };

  const availableDatesInMonth = useMemo(() => {
    if (!selectedCity || !allSlots[selectedCity]) return new Set<string>();
    return new Set(allSlots[selectedCity].map(s => new Date(s).toDateString()));
  }, [selectedCity, allSlots]);

  const slotsForDate = useMemo(() => {
    if (!selectedCity || !selectedDate || !allSlots[selectedCity]) return [];
    return allSlots[selectedCity].filter(s => new Date(s).toDateString() === selectedDate).sort();
  }, [selectedCity, selectedDate, allSlots]);

  const adminGroupedSlots = useMemo(() => {
    const grouped: { [city: string]: { [date: string]: string[] } } = {};
    Object.entries(allSlots).forEach(([city, slots]) => {
      if (!slots || slots.length === 0) return;
      const cityGroup: { [date: string]: string[] } = {};
      slots.forEach(slot => {
        const d = new Date(slot);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!cityGroup[dateKey]) cityGroup[dateKey] = [];
        cityGroup[dateKey].push(slot);
      });
      Object.keys(cityGroup).forEach(date => cityGroup[date].sort());
      grouped[city] = cityGroup;
    });
    return grouped;
  }, [allSlots]);

  const removeSlot = async (city: string, slotToRemove: string) => {
    window.Telegram?.WebApp?.showConfirm(`Удалить слот ${new Date(slotToRemove).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}?`, async (ok) => {
      if (ok) {
        setActionLoading(true);
        const updated = { ...allSlots, [city]: allSlots[city].filter(s => s !== slotToRemove) };
        if (updated[city].length === 0) delete updated[city];
        const success = await saveSlots(updated);
        if (success) setAllSlots(updated);
        setActionLoading(false);
      }
    });
  };

  const changeMonth = (offset: number) => {
    const newMonth = new Date(viewingMonth);
    newMonth.setMonth(newMonth.getMonth() + offset);
    setViewingMonth(newMonth);
  };

  const handleAdminDateClick = (date: Date) => {
    if (!adminRange.start || (adminRange.start && adminRange.end)) {
      setAdminRange({ start: date, end: null });
    } else {
      if (date < adminRange.start) {
        setAdminRange({ start: date, end: adminRange.start });
      } else {
        setAdminRange({ ...adminRange, end: date });
      }
    }
  };

  const generateAdminSlots = async () => {
    if (!adminRange.start || !adminRange.end || (adminConfig.type === 'Offline' && !adminConfig.city)) {
      window.Telegram?.WebApp?.showAlert("Выберите диапазон дат и введите город");
      return;
    }
    setActionLoading(true);
    const generated: string[] = [];
    let currentDay = new Date(adminRange.start);
    currentDay.setHours(0,0,0,0);
    const lastDay = new Date(adminRange.end);
    lastDay.setHours(0,0,0,0);

    while (currentDay <= lastDay) {
      const [sh, sm] = adminConfig.startTime.split(':').map(Number);
      const [eh, em] = adminConfig.endTime.split(':').map(Number);
      let currentSlot = new Date(currentDay);
      currentSlot.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(currentDay);
      dayEnd.setHours(eh, em, 0, 0);

      while (currentSlot < dayEnd) {
        generated.push(currentSlot.toISOString());
        currentSlot = new Date(currentSlot.getTime() + adminConfig.interval * 60000);
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }

    const cityKey = adminConfig.type === 'Online' ? 'online' : adminConfig.city.trim();
    const updated = { ...allSlots, [cityKey]: [...(allSlots[cityKey] || []), ...generated] };
    const success = await saveSlots(updated);
    if (success) {
      setAllSlots(updated);
      setAdminTab('list');
      setAdminRange({ start: null, end: null });
    }
    setActionLoading(false);
  };

  const renderCalendarGrid = (onDateClick: (date: Date) => void, isSelected: (date: Date) => boolean, isInRange?: (date: Date) => boolean) => {
    const days = getDaysInMonth(viewingMonth.getMonth(), viewingMonth.getFullYear());
    const firstDay = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    return (
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
          <div key={d} className="text-[10px] font-black text-black uppercase pb-2">{d}</div>
        ))}
        {Array(offset).fill(null).map((_, i) => <div key={`off-${i}`} />)}
        {days.map(date => {
          const dStr = date.toDateString();
          const selected = isSelected(date);
          const range = isInRange?.(date);
          const hasSlots = availableDatesInMonth.has(dStr);

          return (
            <button
              key={dStr}
              onClick={() => onDateClick(date)}
              className={`h-11 rounded-xl text-sm font-black transition-all flex flex-col items-center justify-center border ${
                selected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 
                range ? 'bg-blue-50 border-blue-100 text-blue-600' : 
                'bg-white border-gray-100 text-black active:bg-blue-50'
              }`}
            >
              <span className="leading-none">{date.getDate()}</span>
              {hasSlots && !selected && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1" />}
              {selected && <div className="w-1.5 h-1.5 bg-white rounded-full mt-1" />}
            </button>
          );
        })}
      </div>
    );
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Spinner size="lg" /></div>;

  if (isSuccess) return (
    <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-white animate-fade-in">
      <div className="w-24 h-24 bg-green-500 rounded-[2.5rem] flex items-center justify-center text-white shadow-xl shadow-green-100 mb-8 animate-bounce">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
      <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2 text-black">Запись подтверждена!</h2>
      <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-8">Теперь последний шаг</p>
      
      <div className="bg-blue-600 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-200 mb-8 w-full border-4 border-white ring-2 ring-blue-50">
        <p className="text-white/80 font-black text-[10px] uppercase tracking-[0.2em] mb-4">Отправьте боту сообщение:</p>
        <div className="bg-white p-6 rounded-2xl shadow-inner mb-4 flex items-center justify-center">
           <p className="text-4xl font-black text-blue-600 uppercase tracking-tighter">ГОТОВО</p>
        </div>
        <p className="text-blue-100 text-[11px] font-bold leading-relaxed uppercase">Без этого слова запись не будет завершена!</p>
      </div>

      <button 
        onClick={() => { 
          if (navigator.clipboard) {
            navigator.clipboard.writeText("Готово");
          }
          window.Telegram?.WebApp?.close(); 
        }} 
        className="w-full py-5 bg-black text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
      >
        Скопировать "Готово" и закрыть
      </button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white font-sans animate-fade-in flex flex-col">
      {currentScreen === Screen.CITY_SELECT && (
        <div className="p-8 flex flex-col items-center justify-center flex-1 space-y-12">
          <div className="text-center space-y-6">
            <div className="inline-flex p-6 bg-blue-50 rounded-[2.5rem] text-blue-500 shadow-sm">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter text-black">Ваш город?</h1>
          </div>
          <div className="w-full space-y-4">
            <input type="text" placeholder="Напр. Москва" value={cityInput} onChange={e => setCityInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCitySearch()} className="w-full p-6 rounded-3xl bg-gray-50 border-2 border-transparent focus:border-blue-500 text-center font-black text-2xl text-black outline-none" />
            <button onClick={handleCitySearch} className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all">Проверить</button>
          </div>
        </div>
      )}

      {currentScreen === Screen.CITY_RESULT && (
        <div className="p-8 flex flex-col items-center justify-center flex-1 space-y-10 text-center">
          {isOfflineAvailable ? (
            <>
              <div className="p-6 bg-green-50 rounded-[2.5rem] text-green-500"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div>
              <h2 className="text-2xl font-black text-gray-900 text-black">В городе {selectedCity} есть оффлайн сессии!</h2>
              <div className="w-full space-y-3">
                <button onClick={() => selectSessionType('offline')} className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">📍 Оффлайн сессия</button>
                <button onClick={() => selectSessionType('online')} className="w-full py-5 bg-white border-2 border-gray-100 text-blue-600 rounded-2xl font-black text-lg active:bg-gray-50 active:scale-95 transition-all">🌐 Онлайн сессия</button>
              </div>
            </>
          ) : (
            <>
              <div className="p-6 bg-orange-50 rounded-[2.5rem] text-orange-500"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg></div>
              <h2 className="text-2xl font-black text-gray-900 text-black">Оффлайн сессий нет, но доступен Онлайн</h2>
              <button onClick={() => selectSessionType('online')} className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">🌐 Записаться онлайн</button>
            </>
          )}
          <button onClick={() => setCurrentScreen(Screen.CITY_SELECT)} className="text-gray-400 font-bold text-xs uppercase tracking-widest">Изменить город</button>
        </div>
      )}

      {currentScreen === Screen.CALENDAR && (
        <div className="flex flex-col flex-1 bg-white overflow-hidden">
          <Header title={selectedCity === 'online' ? "Онлайн" : `📍 ${selectedCity}`} onBack={() => setCurrentScreen(Screen.CITY_RESULT)} />
          <div className="p-6 flex-1 flex flex-col space-y-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <button onClick={() => changeMonth(-1)} className="p-3 bg-black text-white rounded-2xl shadow-lg active:scale-90 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M15 19l-7-7 7-7" /></svg></button>
              <div className="text-center">
                <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Месяц</div>
                <div className="text-xl font-black text-black capitalize leading-none">{viewingMonth.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</div>
              </div>
              <button onClick={() => changeMonth(1)} className="p-3 bg-black text-white rounded-2xl shadow-lg active:scale-90 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M9 5l7 7-7 7" /></svg></button>
            </div>

            <div className="p-5 border-2 border-black rounded-[2.5rem] bg-gray-50 shadow-inner">
              {renderCalendarGrid(
                (date) => { setSelectedDate(date.toDateString()); setSelectedSlot(null); },
                (date) => selectedDate === date.toDateString()
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
               {selectedDate ? (
                 slotsForDate.length > 0 ? (
                   <div className="grid grid-cols-4 gap-2 pb-24">
                    {slotsForDate.map(s => (
                      <button key={s} onClick={() => setSelectedSlot(s)} className={`py-4 rounded-xl font-black text-sm border-2 ${selectedSlot === s ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-gray-100 text-black'}`}>
                        {new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    ))}
                  </div>
                 ) : (
                   <div className="text-center py-8 opacity-40 font-black text-sm uppercase text-black">На этот день нет мест</div>
                 )
              ) : (
                <div className="flex flex-col items-center justify-center py-8 opacity-40 text-center space-y-2 text-black">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  <p className="font-black text-[10px] uppercase">Выберите дату на календаре</p>
                </div>
              )}
            </div>
          </div>
          {selectedSlot && (
            <div className="p-6 bg-white border-t border-gray-100 fixed bottom-0 left-0 right-0 z-50 animate-fade-in shadow-2xl">
              <button onClick={() => setCurrentScreen(Screen.BOOKING_FORM)} className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all">Далее</button>
            </div>
          )}
        </div>
      )}

      {currentScreen === Screen.BOOKING_FORM && (
        <div className="flex flex-col flex-1 bg-white">
          <Header title="Данные для записи" onBack={() => setCurrentScreen(Screen.CALENDAR)} />
          <div className="p-8 space-y-6">
            <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-100">
               <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Ваш слот</div>
               <div className="text-blue-900 font-black text-lg">{selectedSlot && new Date(selectedSlot).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Как вас зовут?</label>
              <input type="text" placeholder="Имя и Фамилия" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl font-black text-black outline-none border-2 border-transparent focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Контактный телефон</label>
              <input type="tel" placeholder="+7 (999) 000-00-00" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl font-black text-black outline-none border-2 border-transparent focus:border-blue-500" />
            </div>
            <button onClick={handleBooking} disabled={actionLoading || !formData.name || !formData.phone} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-2xl disabled:opacity-50 active:scale-95 transition-all">
              {actionLoading ? <Spinner color="white" /> : 'Записаться'}
            </button>
          </div>
        </div>
      )}

      {currentScreen === Screen.ADMIN && (
        <div className="flex flex-col flex-1 bg-gray-50">
          <Header title="Админ: Управление" onBack={() => setCurrentScreen(Screen.CITY_SELECT)} 
            rightElement={
              <div className="flex bg-gray-200 p-1 rounded-xl border border-gray-300">
                <button onClick={() => setAdminTab('create')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${adminTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Создать</button>
                <button onClick={() => setAdminTab('list')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${adminTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Список</button>
              </div>
            }
          />
          <div className="p-5 flex-1 overflow-y-auto">
            {adminTab === 'create' ? (
              <div className="bg-white p-6 rounded-[2.5rem] space-y-6 border border-gray-100 shadow-sm">
                <div className="flex bg-gray-100 p-1 rounded-2xl">
                  <button onClick={() => setAdminConfig({...adminConfig, type: 'Offline'})} className={`flex-1 py-3 rounded-xl font-black text-xs ${adminConfig.type === 'Offline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>📍 Оффлайн</button>
                  <button onClick={() => setAdminConfig({...adminConfig, type: 'Online'})} className={`flex-1 py-3 rounded-xl font-black text-xs ${adminConfig.type === 'Online' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>🌐 Онлайн</button>
                </div>
                {adminConfig.type === 'Offline' && <input type="text" placeholder="Город" value={adminConfig.city} onChange={e => setAdminConfig({...adminConfig, city: e.target.value})} className="w-full p-4 bg-gray-50 rounded-xl font-black border border-gray-100 text-black outline-none" />}
                
                <div className="space-y-4 p-5 border-2 border-black rounded-[2.5rem] bg-white text-black">
                  <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-3 bg-black text-white rounded-xl shadow-sm active:scale-90 transition-all"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M15 19l-7-7 7-7" /></svg></button>
                    <span className="text-sm font-black text-black capitalize">{viewingMonth.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => changeMonth(1)} className="p-3 bg-black text-white rounded-xl shadow-sm active:scale-90 transition-all"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M9 5l7 7-7 7" /></svg></button>
                  </div>
                  {renderCalendarGrid(
                    (date) => handleAdminDateClick(date),
                    (date) => adminRange.start?.toDateString() === date.toDateString() || adminRange.end?.toDateString() === date.toDateString(),
                    (date) => adminRange.start && adminRange.end && date > adminRange.start && date < adminRange.end
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-black">
                   <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 ml-1 uppercase">Старт</label><input type="time" value={adminConfig.startTime} onChange={e => setAdminConfig({...adminConfig, startTime: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 text-black" /></div>
                   <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 ml-1 uppercase">Конец</label><input type="time" value={adminConfig.endTime} onChange={e => setAdminConfig({...adminConfig, endTime: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 text-black" /></div>
                </div>
                <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 ml-1 uppercase">Интервал (мин)</label><input type="number" value={adminConfig.interval} onChange={e => setAdminConfig({...adminConfig, interval: parseInt(e.target.value) || 60})} className="w-full p-4 bg-gray-50 rounded-xl font-black border border-gray-100 text-black" /></div>
                <button onClick={generateAdminSlots} disabled={actionLoading} className="w-full py-5 bg-black text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">Сгенерировать сетку</button>
              </div>
            ) : (
              <div className="space-y-8 pb-24 text-black">
                {Object.entries(adminGroupedSlots).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    <p className="mt-4 font-black uppercase text-xs text-black">Нет активных сессий</p>
                  </div>
                ) : (
                  Object.entries(adminGroupedSlots).map(([cityKey, dates]) => (
                    <div key={cityKey} className="space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between px-3 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-black">
                            {cityKey === 'online' ? '🌐' : '📍'}
                          </div>
                          <h3 className="text-sm font-black text-black uppercase tracking-tight">{cityKey}</h3>
                        </div>
                        <button onClick={() => {
                          window.Telegram?.WebApp?.showConfirm(`Удалить ВСЕ слоты в городе ${cityKey}?`, async (ok) => {
                            if (ok) {
                              const updated = { ...allSlots }; delete updated[cityKey]; setAllSlots(updated); await saveSlots(updated);
                            }
                          });
                        }} className="p-2 bg-red-50 text-red-500 rounded-xl active:scale-90 transition-all">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                      
                      {Object.entries(dates).sort().map(([dateStr, slots]) => (
                        <div key={dateStr} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                          <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-b border-gray-100">
                            <span className="font-black text-xs text-black uppercase tracking-widest">{new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
                            <span className="text-[10px] bg-white border border-gray-200 text-gray-400 px-2 py-0.5 rounded-full font-bold">{slots.length}</span>
                          </div>
                          <div className="p-4 grid grid-cols-4 gap-2">
                            {slots.map(slot => (
                              <button 
                                key={slot} 
                                onClick={() => removeSlot(cityKey, slot)}
                                className="group relative p-2.5 bg-white border border-gray-100 rounded-xl text-[11px] font-black text-black text-center shadow-sm active:bg-red-50 active:border-red-100 transition-all"
                              >
                                {new Date(slot).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                <div className="absolute -top-1 -right-1 opacity-0 group-active:opacity-100 bg-red-500 text-white rounded-full p-0.5">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {actionLoading && (
            <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
