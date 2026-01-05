
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CityPlace } from '../types';

interface CityGuideScreenProps {
  onBack: () => void;
  initialCategory?: string;
}

const CityGuideScreen: React.FC<CityGuideScreenProps> = ({ onBack, initialCategory }) => {
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [places, setPlaces] = useState<CityPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = ['Todos', 'Úteis', 'Saúde', 'Educação', 'Hospedagem', 'Gastronomia', 'Comércio', 'Lazer'];

  useEffect(() => {
    const q = query(collection(db, "city_places"));
    const unsubscribe = onSnapshot(q, 
        (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CityPlace));
            setPlaces(data);
            setLoading(false);
        },
        (error) => {
            console.error("Error fetching city places:", error);
            setLoading(false);
        }
    );
    return () => unsubscribe();
  }, []);

  const filteredPlaces = places.filter(place => {
      const matchesCategory = activeCategory === 'Todos' || place.category === activeCategory;
      const matchesSearch = place.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (place.category && place.category.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (cat: string) => {
      switch(cat) {
          case 'Úteis': return 'contact_phone';
          case 'Saúde': return 'local_hospital';
          case 'Educação': return 'school';
          case 'Hospedagem': return 'hotel';
          case 'Gastronomia': return 'restaurant';
          case 'Comércio': return 'storefront';
          case 'Lazer': return 'attractions';
          default: return 'place';
      }
  };

  const openMap = (address: string, mapLink?: string) => {
      if (mapLink) {
          window.open(mapLink, '_blank');
      } else {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ' Riachão do Jacuípe')}`, '_blank');
      }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-24 font-display overflow-hidden">
       {/* Header */}
       <header className="sticky top-0 z-20 bg-white/95 dark:bg-card-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
        <div className="flex items-center p-4 justify-between h-16">
          <button 
            onClick={onBack}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-800 dark:text-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          
          <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center">
            Guia da Cidade
          </h1>
          
          <div className="size-10"></div>
        </div>

        {/* Search & Filter */}
        <div className="px-4 pb-4 space-y-3">
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input 
                    type="text" 
                    placeholder="Buscar local, telefone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                            activeCategory === cat
                            ? 'bg-primary border-primary text-white shadow-md'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-primary/50'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto no-scrollbar">
        {loading ? (
             <div className="flex flex-col items-center justify-center pt-20 gap-3">
                 <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
             </div>
        ) : filteredPlaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 text-center text-gray-500">
                <span className="material-symbols-outlined text-4xl mb-2">location_off</span>
                <p>Nenhum local encontrado.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {filteredPlaces.map(place => (
                    <div key={place.id} className="bg-white dark:bg-card-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex gap-4">
                        {/* Image or Icon */}
                        <div className="w-20 h-20 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center border border-gray-100 dark:border-gray-700">
                            {place.image ? (
                                <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500">
                                    {getCategoryIcon(place.category)}
                                </span>
                            )}
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex justify-between items-start">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate pr-2">{place.name}</h3>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{place.category}</span>
                            </div>
                            
                            {place.address && (
                                <p 
                                    onClick={() => openMap(place.address!, place.mapLink)}
                                    className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 cursor-pointer hover:text-primary flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                                    {place.address}
                                </p>
                            )}
                            
                            <div className="flex items-center gap-3 mt-3">
                                {place.phone && (
                                    <a 
                                        href={`tel:${place.phone.replace(/\D/g,'')}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">call</span>
                                        Ligar
                                    </a>
                                )}
                                {place.address && (
                                    <button 
                                        onClick={() => openMap(place.address!, place.mapLink)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">map</span>
                                        Mapa
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>
    </div>
  );
};

export default CityGuideScreen;
