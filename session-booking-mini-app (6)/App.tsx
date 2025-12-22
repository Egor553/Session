
import React, { useState, useEffect, useMemo } from 'react';
import { Screen, SlotMap, BookingData } from './types';
import { getSlots, saveSlots, createBooking } from './services/api';

// --- Components ---

const Header = ({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose?: () => void }) => (
  <header className="px-4 py-4 flex items-center justify-between bg-white sticky top-0 z-50 border-b border-gray-100 w-full max-w-md mx-auto">
    <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-blue-500 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">{title}</h1>
    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </header>
);

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.CITY_SELECT);
  const [allSlots, setAllSlots] = useState<SlotMap>({});
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [cityInput, setCityInput] = useState('');
  
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [foundCityName, setFoundCityName] = useState<string | null>(null);

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
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const data = await getSlots();
      setAllSlots(data);
    } catch (err) {
      console.error("Error fetching slots:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckCity = () => {
    const target = cityInput.trim();
    if (!target) return;
    
    if (target.toLowerCase() === 'admin123') {
      setCurrentScreen(Screen.ADMIN);
      return;
    }

    const matchedCityKey = Object.keys(allSlots).find(k => k.toLowerCase() === target.toLowerCase() && k.toLowerCase() !== 'online');
    
    setSearchPerformed(true);
    if (matchedCityKey) {
      setFoundCityName(matchedCityKey);
    } else {
      setFoundCityName(null);
    }
  };

  const startBooking = (city: string) => {
    setSelectedCity(city);
    setCurrentScreen(Screen.CALENDAR);
  };

  const handleBooking = async (name: string, phone: string) => {
    if (!selectedCity || !selectedSlot) return;
    setLoading(true);
    
    const dateObj = new Date(selectedSlot);
    const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

    const externalId = window.Telegram.WebApp.initDataUnsafe.start_param || 
                       window.Telegram.WebApp.initDataUnsafe.user?.id?.toString() || "";

    const bookingPayload: BookingData = {
      type: selectedCity === 'online' ? 'Online' : 'Offline',
      city: selectedCity === 'online' ? 'Онлайн' : selectedCity,
      slot: formattedDate,
      full_name: name,
      phone: phone,
      external_id: externalId
    };

    try {
      const success = await createBooking(bookingPayload);
      if (success) {
        const updatedCitySlots = (allSlots[selectedCity] || []).filter(s => s !== selectedSlot);
        const updatedAllSlots = { ...allSlots, [selectedCity]: updatedCitySlots };
        await saveSlots(updatedAllSlots);
        
        setIsSuccess(true);
        setTimeout(() => {
          window.Telegram.WebApp.close();
        }, 2000);
      } else {
        throw new Error('Server error during booking');
      }
    } catch (err) {
      alert('Не удалось сохранить запись. Пожалуйста, проверьте интернет.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateAdminSlots = async () => {
    if (!adminConfig.startDate || !adminConfig.endDate) {
      alert('Выберите диапазон дат на календаре');
      return;
    }

    setLoading(true);
    const newSlots = { ...allSlots };
    const cityKey = adminConfig.type === 'Online' ? 'online' : adminConfig.city;
    
    if (!cityKey) {
      alert('Введите название города');
      setLoading(false);
      return;
    }

    const start = new Date(adminConfig.startDate);
    const end = new Date(adminConfig.endDate);
    const generated: string[] = [];

    let current = new Date(start);
    while (current <= end) {
      const dayStart = new Date(current);
      dayStart.setHours(parseInt(adminConfig.startTime.split(':')[0]), parseInt(adminConfig.startTime.split(':')[1]), 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(parseInt(adminConfig.endTime.split(':')[0]), parseInt(adminConfig.endTime.split(':')[1]), 0);

      let slotTime = new Date(dayStart);
      while (slotTime <= dayEnd) {
        generated.push(slotTime.toISOString());
        slotTime.setMinutes(slotTime.getMinutes() + adminConfig.interval);
      }
      current.setDate(current.getDate() + 1);
    }

    newSlots[cityKey] = [...(newSlots[cityKey] || []), ...generated];
    await saveSlots(newSlots);
    setAllSlots(newSlots);
    alert('Слоты успешно созданы');
    setCurrentScreen(Screen.CITY_SELECT);
    setLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white animate-slide-up text-center space-y-6">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-black text-gray-900">Вы записаны!</h2>
        <p className="text-gray-500 font-medium">Сейчас вы вернетесь в чат с ботом для подтверждения.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      {currentScreen === Screen.CITY_SELECT && (
        <div className="p-8 flex flex-col items-center justify-center min-h-screen space-y-12 animate-slide-up max-w-md mx-auto text-center">
          <div className="w-24 h-24 bg-blue-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/40 transform hover:scale-105 transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight text-gray-900">Запись на сессию</h1>
            <p className="text-gray-400 font-semibold tracking-wide uppercase text-[10px]">Ваш комфорт — наш приоритет</p>
          </div>

          {!searchPerformed ? (
            <div className="w-full max-w-xs space-y-4 animate-slide-up">
              <input
                type="text"
                placeholder="В каком вы городе?"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckCity()}
                className="w-full p-6 rounded-3xl bg-gray-50 border border-gray-100 outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all font-bold text-center placeholder:text-gray-300 shadow-sm"
              />
              <button
                onClick={handleCheckCity}
                disabled={!cityInput.trim()}
                className="w-full bg-blue-500 text-white p-5 rounded-3xl font-black shadow-xl shadow-blue-500/30 active:scale-95 transition-all hover:bg-blue-600 disabled:opacity-50"
              >
                Проверить доступность
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-8 animate-slide-up">
              {foundCityName ? (
                <div className="space-y-6">
                  <div className="p-6 rounded-[2rem] bg-green-50 border border-green-100">
                    <p className="text-green-800 font-bold leading-relaxed">
                      У вас есть доступные сессии в вашем городе. Можете записаться на них.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => startBooking(foundCityName)}
                      className="w-full bg-blue-500 text-white p-5 rounded-3xl font-black shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
                    >
                      Записаться оффлайн
                    </button>
                    <button
                      onClick={() => startBooking('online')}
                      className="w-full bg-white border-2 border-blue-500 text-blue-500 p-5 rounded-3xl font-black active:scale-95 transition-all"
                    >
                      Записаться онлайн
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100">
                    <p className="text-amber-800 font-bold leading-relaxed">
                      В вашем городе пока нет офлайн сессий. Можете записаться на онлайн сессию.
                    </p>
                  </div>
                  <button
                    onClick={() => startBooking('online')}
                    className="w-full bg-blue-500 text-white p-5 rounded-3xl font-black shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
                  >
                    Записаться на онлайн сессию
                  </button>
                </div>
              )}
              
              <button 
                onClick={() => { setSearchPerformed(false); setCityInput(''); }}
                className="text-xs font-black text-gray-300 uppercase tracking-widest hover:text-blue-500 transition-colors"
              >
                ← Изменить город
              </button>
            </div>
          )}
        </div>
      )}

      {currentScreen === Screen.CALENDAR && (
        <div className="animate-slide-up pb-32">
          <Header 
            title={selectedCity === 'online' ? 'Онлайн сессия' : `Сессия: ${selectedCity}`} 
            onBack={() => setCurrentScreen(Screen.CITY_SELECT)} 
            onClose={() => window.Telegram.WebApp.close()} 
          />
          
          <div className="px-6 mt-8 space-y-10 max-w-md mx-auto">
            <div className="space-y-6">
              <h2 className="text-2xl font-black tracking-tight text-gray-800">Выберите дату</h2>
              <GridCalendar 
                slots={allSlots[selectedCity] || []} 
                selectedDate={selectedDate} 
                onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }} 
              />
            </div>

            {selectedDate && (
              <div className="space-y-6 animate-slide-up">
                <h2 className="text-2xl font-black tracking-tight text-gray-800">Доступные слоты</h2>
                <div className="grid grid-cols-3 gap-3">
                  {(allSlots[selectedCity] || [])
                    .filter(s => s.startsWith(selectedDate))
                    .sort()
                    .map(slot => {
                      const time = new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-4 rounded-2xl text-sm font-black transition-all border-2 ${isSelected ? 'bg-blue-500 text-white border-blue-500 shadow-lg scale-105' : 'bg-white text-gray-700 border-gray-100 active:bg-gray-50'}`}
                        >
                          {time}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {selectedSlot && (
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-2xl border-t border-gray-100 z-50 animate-slide-up flex justify-center">
              <div className="w-full max-w-md">
                <button
                  onClick={() => setCurrentScreen(Screen.BOOKING_FORM)}
                  className="w-full py-5 rounded-[2rem] bg-blue-500 text-white font-black text-lg shadow-2xl shadow-blue-500/40 active:scale-95 hover:bg-blue-600 transition-all"
                >
                  Записаться на {new Date(selectedSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentScreen === Screen.BOOKING_FORM && (
        <div className="animate-slide-up">
          <Header title="Данные записи" onBack={() => setCurrentScreen(Screen.CALENDAR)} onClose={() => window.Telegram.WebApp.close()} />
          <div className="p-6 space-y-8 max-w-md mx-auto">
            <div className="p-10 rounded-[3rem] bg-blue-50 border border-blue-100 space-y-2 text-center shadow-inner">
              <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest">Вы выбрали</p>
              <p className="text-blue-900 text-2xl font-black">
                {selectedSlot && new Date(selectedSlot).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleBooking(formData.get('name') as string, formData.get('phone') as string);
            }}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 ml-4 uppercase tracking-widest">Ваше полное имя</label>
                <input required name="name" type="text" placeholder="Александр Пушкин" className="w-full p-5 rounded-3xl bg-gray-50 border-none outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white font-bold transition-all shadow-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 ml-4 uppercase tracking-widest">Контактный телефон</label>
                <input required name="phone" type="tel" placeholder="+7 (___) ___-__-__" className="w-full p-5 rounded-3xl bg-gray-50 border-none outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white font-bold transition-all shadow-sm" />
              </div>
              <button disabled={loading} type="submit" className="w-full py-5 rounded-[2.5rem] bg-blue-500 text-white font-black text-lg shadow-2xl shadow-blue-500/40 active:scale-95 transition-all disabled:opacity-50 mt-4">
                {loading ? 'Идет сохранение...' : 'Завершить запись'}
              </button>
            </form>
          </div>
        </div>
      )}

      {currentScreen === Screen.ADMIN && (
        <div className="p-6 space-y-6 animate-slide-up pb-20 max-w-md mx-auto">
          <Header title="Администратор" onBack={() => setCurrentScreen(Screen.CITY_SELECT)} onClose={() => window.Telegram.WebApp.close()} />
          <div className="space-y-8">
            <div className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">ФОРМАТ СЕССИИ</label>
                <select className="w-full p-5 bg-white rounded-3xl font-bold outline-none border-none shadow-sm" onChange={e => setAdminConfig({...adminConfig, type: e.target.value})}>
                  <option value="Offline">Оффлайн (в городе)</option>
                  <option value="Online">Онлайн</option>
                </select>
              </div>

              {adminConfig.type === 'Offline' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">ГОРОД</label>
                  <input type="text" placeholder="Напр. Астана" className="w-full p-5 bg-white rounded-3xl font-bold outline-none border-none shadow-sm" value={adminConfig.city} onChange={e => setAdminConfig({...adminConfig, city: e.target.value})} />
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">ИНТЕРВАЛ ДАТ</label>
                <AdminRangeCalendar 
                  startDate={adminConfig.startDate} 
                  endDate={adminConfig.endDate} 
                  onSelect={(start, end) => setAdminConfig({...adminConfig, startDate: start, endDate: end})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="time" className="p-5 bg-white rounded-3xl font-bold shadow-sm" defaultValue="10:00" onChange={e => setAdminConfig({...adminConfig, startTime: e.target.value})} />
                <input type="time" className="p-5 bg-white rounded-3xl font-bold shadow-sm" defaultValue="18:00" onChange={e => setAdminConfig({...adminConfig, endTime: e.target.value})} />
              </div>

              <input type="number" placeholder="Интервал (мин)" className="w-full p-5 bg-white rounded-3xl font-bold shadow-sm" defaultValue="60" onChange={e => setAdminConfig({...adminConfig, interval: parseInt(e.target.value)})} />

              <button onClick={generateAdminSlots} className="w-full py-5 bg-gray-900 text-white rounded-[2rem] font-black shadow-xl active:scale-95 transition-all">
                Создать сетку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Calendar Components ---

const GridCalendar = ({ slots, selectedDate, onSelect }: { slots: string[], selectedDate: string | null, onSelect: (d: string) => void }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const availableDates = useMemo(() => new Set(slots.map(s => s.split('T')[0])), [slots]);
  
  const { days, monthLabel } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const shift = firstDay === 0 ? 6 : firstDay - 1;
    const daysArr = [];
    for (let i = 0; i < shift; i++) daysArr.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const iso = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      daysArr.push({ day: i, iso });
    }
    const label = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(viewDate);
    return { days: daysArr, monthLabel: label.charAt(0).toUpperCase() + label.slice(1) };
  }, [viewDate]);

  const weekDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  return (
    <div className="bg-gray-50 rounded-[2.5rem] p-6 border border-gray-100 shadow-xl shadow-gray-200/50 md:max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-6 px-2">
        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-2 text-gray-400 bg-white rounded-xl shadow-sm"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
        <span className="font-black text-gray-800 text-sm uppercase">{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-2 text-gray-400 bg-white rounded-xl shadow-sm"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
      </div>
      <div className="grid grid-cols-7 mb-4">{weekDays.map(d => <div key={d} className="text-center text-[9px] font-black text-gray-300 py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, idx) => {
          if (!d) return <div key={`empty-${idx}`} />;
          const isAvailable = availableDates.has(d.iso);
          const isSelected = selectedDate === d.iso;
          return (
            <button key={d.iso} disabled={!isAvailable} onClick={() => onSelect(d.iso)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all relative ${isSelected ? 'bg-blue-500 text-white shadow-xl scale-110 font-black' : ''} ${isAvailable && !isSelected ? 'bg-white text-gray-900 font-black border border-blue-100' : ''} ${!isAvailable ? 'text-gray-200 cursor-not-allowed text-[10px]' : 'text-xs'}`}>
              <span>{d.day}</span>
              {isAvailable && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-blue-500 rounded-full"></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AdminRangeCalendar = ({ startDate, endDate, onSelect }: { startDate: string, endDate: string, onSelect: (start: string, end: string) => void }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const { days, monthLabel } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const shift = firstDay === 0 ? 6 : firstDay - 1;
    const daysArr = [];
    for (let i = 0; i < shift; i++) daysArr.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const iso = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      daysArr.push({ day: i, iso });
    }
    const label = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(viewDate);
    return { days: daysArr, monthLabel: label.charAt(0).toUpperCase() + label.slice(1) };
  }, [viewDate]);

  const handleDateClick = (iso: string) => {
    if (!startDate || (startDate && endDate)) onSelect(iso, '');
    else if (new Date(iso) < new Date(startDate)) onSelect(iso, '');
    else onSelect(startDate, iso);
  };

  const isInRange = (iso: string) => {
    if (!startDate || !endDate) return false;
    const current = new Date(iso);
    return current >= new Date(startDate) && current <= new Date(endDate);
  };

  const weekDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  return (
    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-2 text-gray-400"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
        <span className="font-bold text-gray-700 text-xs uppercase">{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-2 text-gray-400"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
      </div>
      <div className="grid grid-cols-7 mb-2">{weekDays.map(d => <div key={d} className="text-center text-[8px] font-black text-gray-300">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, idx) => {
          if (!d) return <div key={`empty-${idx}`} />;
          const isStart = startDate === d.iso;
          const isEnd = endDate === d.iso;
          const inRange = isInRange(d.iso);
          return (
            <button key={d.iso} onClick={() => handleDateClick(d.iso)} className={`aspect-square rounded-xl flex items-center justify-center text-[10px] transition-all ${isStart || isEnd ? 'bg-blue-600 text-white font-black z-10' : ''} ${inRange && !isStart && !isEnd ? 'bg-blue-100 text-blue-600 font-bold' : 'text-gray-600'}`}>
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default App;
