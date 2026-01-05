
import React, { useEffect, useState } from 'react';

interface WeatherScreenProps {
  onBack: () => void;
}

const WeatherScreen: React.FC<WeatherScreenProps> = ({ onBack }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // WMO Codes to Text and Icon
  const getWeatherInfo = (code: number, isDay: number) => {
    if (code === 0) return { label: 'Céu Limpo', icon: isDay ? 'sunny' : 'clear_night' };
    if (code >= 1 && code <= 3) return { label: 'Parcialmente Nublado', icon: isDay ? 'partly_cloudy_day' : 'partly_cloudy_night' };
    if (code >= 45 && code <= 48) return { label: 'Nevoeiro', icon: 'foggy' };
    if (code >= 51 && code <= 67) return { label: 'Chuva Fraca', icon: 'rainy' };
    if (code >= 80 && code <= 99) return { label: 'Tempestade', icon: 'thunderstorm' };
    return { label: 'Nublado', icon: 'cloud' };
  };

  const getWeekDay = (dateStr: string) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[new Date(dateStr).getDay()];
  };

  useEffect(() => {
    const fetchFullWeather = async () => {
      try {
        // Usando Fuso Horário específico da Bahia e Coordenadas Exatas de Riachão do Jacuípe
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-11.8069&longitude=-39.3856&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=America%2FBahia');
        const json = await res.json();
        setData(json);
        setLoading(false);
      } catch (e) {
        console.error("Error fetching weather", e);
        setLoading(false);
      }
    };
    fetchFullWeather();
  }, []);

  if (loading) {
    return (
        <div className="flex h-screen items-center justify-center bg-background-light dark:bg-background-dark">
            <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
    );
  }

  if (!data) return null;

  const current = data.current;
  const weatherInfo = getWeatherInfo(current.weather_code, current.is_day);
  const isNight = current.is_day === 0;

  // --- Lógica Ajustada para Previsão Horária ---
  const now = new Date();
  
  // Encontra o índice da hora atual nos dados retornados (que cobrem vários dias)
  const currentHourIndex = data.hourly.time.findIndex((t: string) => {
      const timeDate = new Date(t);
      return timeDate.getDate() === now.getDate() && timeDate.getHours() === now.getHours();
  });

  // Se não encontrar (erro de fuso ou dados), começa do zero. Senão, usa o índice atual.
  const startIndex = currentHourIndex !== -1 ? currentHourIndex : 0;

  // Pega as próximas 24 horas a partir de AGORA
  const next24Hours = data.hourly.time
      .slice(startIndex, startIndex + 24)
      .map((time: string, i: number) => {
          // Precisamos acessar os arrays originais usando o índice deslocado (startIndex + i)
          const dataIndex = startIndex + i;
          return {
            time: new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            temp: Math.round(data.hourly.temperature_2m[dataIndex]),
            code: data.hourly.weather_code[dataIndex],
            isDay: data.hourly.is_day[dataIndex]
          };
      });

  // Daily Data (Next 7 days)
  const dailyForecast = data.daily.time.map((time: string, i: number) => ({
      date: new Date(time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      weekday: getWeekDay(time),
      max: Math.round(data.daily.temperature_2m_max[i]),
      min: Math.round(data.daily.temperature_2m_min[i]),
      code: data.daily.weather_code[i]
  }));

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden font-display bg-background-light dark:bg-background-dark">
      
      {/* Header Standard */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-card-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
        <button onClick={onBack} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Riachão do Jacuípe - BA</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 p-4 pb-10 space-y-6">
        
        {/* Hero Card - The only part that changes dramatically based on Day/Night */}
        <div className={`rounded-[2rem] p-6 shadow-lg relative overflow-hidden transition-all duration-500 ${isNight ? 'bg-gradient-to-br from-[#1e1b4b] to-[#312e81] text-white shadow-indigo-900/20' : 'bg-gradient-to-br from-blue-500 to-blue-400 text-white shadow-blue-500/20'}`}>
            
            {/* Background Decoration */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-20 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

            <div className="relative z-10 flex flex-col items-center text-center pt-2">
                <div className="mb-2 animate-in zoom-in duration-700">
                    <span className="material-symbols-outlined text-[84px] drop-shadow-md filter">{weatherInfo.icon}</span>
                </div>
                <h2 className="text-6xl font-black tracking-tighter drop-shadow-sm mb-1">{Math.round(current.temperature_2m)}°</h2>
                <p className="text-lg font-medium opacity-90 capitalize mb-6">{weatherInfo.label}</p>
                
                {/* Mini Details Grid inside Card */}
                <div className="grid grid-cols-3 gap-2 w-full bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
                    <div className="flex flex-col items-center gap-1">
                        <span className="material-symbols-outlined text-lg opacity-80">water_drop</span>
                        <span className="text-xs font-bold">{current.relative_humidity_2m}%</span>
                        <span className="text-[9px] opacity-70 uppercase tracking-wide">Umidade</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 border-l border-white/10 px-2">
                        <span className="material-symbols-outlined text-lg opacity-80">air</span>
                        <span className="text-xs font-bold">{current.wind_speed_10m} <span className="text-[9px] font-normal">km/h</span></span>
                        <span className="text-[9px] opacity-70 uppercase tracking-wide">Vento</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 border-l border-white/10">
                        <span className="material-symbols-outlined text-lg opacity-80">umbrella</span>
                        <span className="text-xs font-bold">{current.precipitation} <span className="text-[9px] font-normal">mm</span></span>
                        <span className="text-[9px] opacity-70 uppercase tracking-wide">Chuva</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Hourly Forecast - Standard UI */}
        <section>
            <div className="flex items-center gap-2 mb-3 px-1">
                <span className="material-symbols-outlined text-slate-400 text-sm">schedule</span>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Previsão 24h</h3>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar pl-1">
                {next24Hours.map((hour: any, i: number) => {
                    const info = getWeatherInfo(hour.code, hour.isDay);
                    // Highlight the first item (current hour)
                    const isNow = i === 0;
                    return (
                        <div key={i} className={`flex flex-col items-center gap-2 min-w-[70px] rounded-2xl p-3 border transition-all ${isNow ? 'bg-primary text-white border-primary shadow-lg shadow-blue-500/25 scale-105' : 'bg-white dark:bg-card-dark border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            <span className={`text-xs font-medium ${isNow ? 'opacity-90' : 'opacity-60'}`}>{isNow ? 'Agora' : hour.time}</span>
                            <span className="material-symbols-outlined text-2xl my-1">{info.icon}</span>
                            <span className="font-bold text-sm">{hour.temp}°</span>
                        </div>
                    )
                })}
            </div>
        </section>

        {/* Daily Forecast - Standard List UI */}
        <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Próximos 7 Dias</h3>
            </div>
            <div className="space-y-5">
                {dailyForecast.slice(1, 8).map((day: any, i: number) => {
                    const info = getWeatherInfo(day.code, 1);
                    return (
                        <div key={i} className="flex items-center justify-between group">
                            <div className="w-12 font-bold text-sm text-slate-900 dark:text-white">{day.weekday}</div>
                            
                            <div className="flex-1 flex items-center gap-3 px-4">
                                <span className={`material-symbols-outlined text-xl ${info.label.includes('Chuva') || info.label.includes('Tempestade') ? 'text-blue-500' : 'text-orange-500'}`}>
                                    {info.icon}
                                </span>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{info.label}</span>
                            </div>
                            
                            <div className="flex gap-4 font-mono text-sm">
                                <span className="text-slate-400 dark:text-slate-600">{day.min}°</span>
                                <span className="font-bold text-slate-900 dark:text-white">{day.max}°</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>

        <div className="text-center">
            <p className="text-[10px] text-gray-400">
                Atualizado agora • Fonte: Open-Meteo
            </p>
        </div>

      </main>
    </div>
  );
};

export default WeatherScreen;
