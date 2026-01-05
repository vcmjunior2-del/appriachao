
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { ServiceTypeDefinition } from '../types';

// Declaration for Leaflet attached to window via CDN in index.html
declare global {
  interface Window {
    L: any;
  }
}

interface ServiceDetailsScreenProps {
  onBack: () => void;
  service: ServiceTypeDefinition | null;
}

const ServiceDetailsScreen: React.FC<ServiceDetailsScreenProps> = ({ onBack, service }) => {
  const { currentUser } = useAuth();
  
  // --- Form States ---
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [description, setDescription] = useState('');
  
  // Validation State
  const [errors, setErrors] = useState<{location?: string; description?: string; photos?: string}>({});
  
  // We keep two arrays: one for preview (blob URLs) and one for actual files to upload
  const [photos, setPhotos] = useState<string[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  
  // --- UI States ---
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(''); // Feedback for user
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // --- Refs ---
  const previewMapRef = useRef<any>(null);
  const modalMapRef = useRef<any>(null);
  const modalMarkerRef = useRef<any>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const previewMapContainerId = "map-preview-container";
  const modalMapContainerId = "map-modal-container";

  // --- Constants (Riachão do Jacuípe - BA) ---
  const DEFAULT_LAT = -11.8069;
  const DEFAULT_LNG = -39.3856;
  const CITY_VIEW_ZOOM = 14; 
  const STREET_VIEW_ZOOM = 17;

  // --- Color Mapping Helper ---
  const getColorClasses = (theme: string) => {
      switch(theme) {
          case 'blue': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' };
          case 'green': return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' };
          case 'red': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' };
          case 'yellow': return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' };
          case 'purple': return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' };
          default: return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300' };
      }
  };

  const themeColors = service ? getColorClasses(service.colorTheme) : { bg: 'bg-gray-100', text: 'text-gray-600' };
  const isUrl = (str?: string) => str ? (str.includes('http') || str.includes('data:')) : false;

  // --- Helper: Custom Map Icon ---
  const createCustomIcon = () => {
    if (!window.L) return null;
    return window.L.divIcon({
      className: 'custom-map-marker',
      html: `<div style="
        position: relative;
        width: 36px; 
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span class="material-symbols-outlined" style="
          font-size: 36px; 
          color: #ea4335; 
          filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));
          font-variation-settings: 'FILL' 1;
        ">location_on</span>
        <div style="
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 4px;
          background: rgba(0,0,0,0.2);
          border-radius: 50%;
          filter: blur(1px);
        "></div>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 34],
    });
  };

  // --- Logic: Geocoding ---
  const fetchAddress = async (lat: number, lng: number) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const response = await fetch(url, { headers: { 'User-Agent': 'RiachaoCidadaoApp/1.0' } });
        const data = await response.json();
        
        if (data && data.address) {
            const road = data.address.road || data.address.pedestrian || data.address.street || '';
            const number = data.address.house_number || '';
            const neighborhood = data.address.suburb || data.address.neighbourhood || data.address.district || '';
            
            let formattedAddr = road;
            if (number) formattedAddr += `, Nº ${number}`;
            else formattedAddr += `, S/N`;
            if (neighborhood) formattedAddr += ` - ${neighborhood}`;

            if (!road) formattedAddr = data.display_name ? data.display_name.split(',')[0] : 'Local marcado no mapa';
            
            setAddress(formattedAddr);
            if (errors.location) setErrors(prev => ({...prev, location: undefined})); // Clear error
        } else {
            setAddress(`Lat: ${lat.toFixed(5)}, Long: ${lng.toFixed(5)}`);
        }
    } catch (error) {
        console.error("Geocoding error", error);
        setAddress(`Lat: ${lat.toFixed(5)}, Long: ${lng.toFixed(5)}`);
    }
  };

  // --- Logic: GPS ---
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não é suportada.");
      return;
    }
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        await fetchAddress(lat, lng);
        updateMaps(lat, lng);
        setIsLoadingLocation(false);
      },
      (error) => {
        console.warn("GPS Error", error);
        alert("Não foi possível obter sua localização. Verifique o GPS.");
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // --- Logic: Maps Update ---
  const updateMaps = (lat: number, lng: number) => {
    // Preview Map
    if (previewMapRef.current) {
        previewMapRef.current.setView([lat, lng], STREET_VIEW_ZOOM);
        previewMapRef.current.eachLayer((layer: any) => {
            if (layer instanceof window.L.Marker) previewMapRef.current.removeLayer(layer);
        });
        const customIcon = createCustomIcon();
        if (customIcon) {
            window.L.marker([lat, lng], { interactive: false, icon: customIcon }).addTo(previewMapRef.current);
        }
    }
    // Modal Map
    if (modalMapRef.current && modalMarkerRef.current) {
        modalMapRef.current.setView([lat, lng], 18);
        modalMarkerRef.current.setLatLng([lat, lng]);
    }
  };

  // --- Logic: Photos ---
  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newPreviewUrls: string[] = [];
      const newRawFiles: File[] = [];

      Array.from(files).forEach((item) => {
        const file = item as File;
        // Create local preview URL
        const url = URL.createObjectURL(file);
        newPreviewUrls.push(url);
        newRawFiles.push(file);
      });

      // Update both states
      setPhotos(prev => [...prev, ...newPreviewUrls]);
      setRawFiles(prev => [...prev, ...newRawFiles]);
      if (errors.photos) setErrors(prev => ({...prev, photos: undefined})); // Clear error
    }
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setRawFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Logic: Submit to Firestore with Image Upload ---
  const handleSubmit = async () => {
    if (!service) return;

    if (!currentUser) {
        alert("Você precisa estar logado.");
        return;
    }
    
    // Check requirements and Set Errors
    const newErrors: {location?: string; description?: string; photos?: string} = {};
    let hasError = false;

    if (service.requiresLocation && !address) {
        newErrors.location = "Por favor, informe a localização do problema.";
        hasError = true;
    }
    
    if (!description.trim()) {
        newErrors.description = "Descreva o problema para que possamos ajudar.";
        hasError = true;
    }

    if (service.requiresPhoto && photos.length === 0) {
        newErrors.photos = "É obrigatório anexar pelo menos uma foto.";
        hasError = true;
    }

    setErrors(newErrors);

    if (hasError) {
        // Optional: Vibrate or simple alert to draw attention if user missed visual cues
        if (navigator.vibrate) navigator.vibrate(200);
        return;
    }

    setIsSubmitting(true);
    setUploadProgress('Iniciando envio...');

    try {
        const uploadedPhotoUrls: string[] = [];

        // 1. Upload Photos to Firebase Storage
        if (rawFiles.length > 0) {
            setUploadProgress(`Enviando ${rawFiles.length} foto(s)...`);
            
            // Upload sequentially or parallel (Parallel is faster)
            const uploadPromises = rawFiles.map(async (file, index) => {
                // Generate a safe, unique filename: evidence/USER_ID/TIMESTAMP_INDEX_FILENAME
                const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
                const path = `evidence/${currentUser.uid}/${Date.now()}_${index}_${safeName}`;
                const fileRef = ref(storage, path);
                
                // Add metadata for better management and rule validation
                const metadata = {
                    contentType: file.type,
                    customMetadata: {
                        uploadedBy: currentUser.uid,
                        originalName: file.name
                    }
                };

                await uploadBytes(fileRef, file, metadata);
                const downloadUrl = await getDownloadURL(fileRef);
                return downloadUrl;
            });

            const urls = await Promise.all(uploadPromises);
            uploadedPhotoUrls.push(...urls);
        }

        setUploadProgress('Salvando dados...');

        // 2. Save Document to Firestore
        const docRef = await addDoc(collection(db, "requests"), {
            userId: currentUser.uid,
            userName: currentUser.displayName || "Anônimo",
            title: service.title,
            department: service.secretariatId,
            description: description,
            address: address || "Não informado",
            location: coords ? { lat: coords.lat, lng: coords.lng } : null,
            status: "Aberto",
            date: serverTimestamp(),
            icon: service.icon,
            iconBg: themeColors.bg,
            iconColor: themeColors.text,
            statusColor: 'text-blue-700 dark:text-blue-300',
            statusBg: 'bg-blue-100 dark:bg-blue-900/30',
            photos: uploadedPhotoUrls // Save the real Cloud URLs here
        });

        console.log("Documento salvo com ID: ", docRef.id);
        setIsSubmitting(false);
        setUploadProgress('');
        setShowSuccessModal(true);

    } catch (error: any) {
        console.error("Error submitting request:", error);
        
        let msg = "Erro ao enviar solicitação.";
        
        if (error.code === 'storage/unauthorized') {
            msg = "Permissão negada ao enviar fotos. Verifique as Regras de Segurança do Storage no Console do Firebase. (Requer autenticação)";
        } else if (error.code === 'storage/canceled') {
            msg = "Envio de foto cancelado.";
        } else if (error.code === 'permission-denied') {
            msg = "Erro de permissão no banco de dados. Verifique as regras do Firestore.";
        }

        alert(msg);
        setIsSubmitting(false);
        setUploadProgress('');
    }
  };

  // --- Effects (Maps) ---
  useEffect(() => {
    if (!service?.requiresLocation) return; // Only init map if needed

    const timer = setTimeout(() => {
        if (!window.L || previewMapRef.current) return;
        
        const container = document.getElementById(previewMapContainerId);
        if (container) {
            const startLat = coords ? coords.lat : DEFAULT_LAT;
            const startLng = coords ? coords.lng : DEFAULT_LNG;
            const startZoom = coords ? STREET_VIEW_ZOOM : CITY_VIEW_ZOOM;

            const map = window.L.map(previewMapContainerId, {
                attributionControl: false,
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                touchZoom: false
            }).setView([startLat, startLng], startZoom);

            // CHANGED TO OPENSTREETMAP STANDARD
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(map);

            if (coords) {
                const customIcon = createCustomIcon();
                if (customIcon) window.L.marker([startLat, startLng], { interactive: false, icon: customIcon }).addTo(map);
            }
            previewMapRef.current = map;
        }
    }, 100);
    return () => clearTimeout(timer);
  }, [service]); 

  useEffect(() => {
    if (isMapModalOpen) {
        setTimeout(() => {
            if (!window.L) return;
            if (modalMapRef.current) {
                modalMapRef.current.invalidateSize();
                if (coords) {
                    modalMapRef.current.setView([coords.lat, coords.lng], 18);
                    modalMarkerRef.current.setLatLng([coords.lat, coords.lng]);
                }
                return;
            }

            const startLat = coords ? coords.lat : DEFAULT_LAT;
            const startLng = coords ? coords.lng : DEFAULT_LNG;
            const startZoom = coords ? 18 : CITY_VIEW_ZOOM;

            const map = window.L.map(modalMapContainerId, { zoomControl: false }).setView([startLat, startLng], startZoom);

            // CHANGED TO OPENSTREETMAP STANDARD
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            const customIcon = createCustomIcon();
            const marker = window.L.marker([startLat, startLng], {
                draggable: true,
                autoPan: true,
                icon: customIcon
            }).addTo(map);

            marker.on('dragend', async (e: any) => {
                const newPos = e.target.getLatLng();
                setCoords({ lat: newPos.lat, lng: newPos.lng });
                await fetchAddress(newPos.lat, newPos.lng);
                updateMaps(newPos.lat, newPos.lng);
            });

            modalMapRef.current = map;
            modalMarkerRef.current = marker;
        }, 300);
    }
  }, [isMapModalOpen]);


  // --- Render Fallback if no service selected ---
  if (!service) {
      return (
          <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
              <p className="text-gray-500">Nenhum serviço selecionado.</p>
              <button onClick={onBack} className="ml-2 text-primary">Voltar</button>
          </div>
      )
  }

  if (showSuccessModal) {
    return (
        <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-white dark:bg-background-dark p-6 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Solicitação Enviada!</h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8 max-w-xs">
                Seu pedido foi registrado com sucesso. Você pode acompanhar o status na aba "Minhas Solicitações".
            </p>
            <div className="w-full max-w-xs flex flex-col gap-3">
                <button 
                    onClick={onBack} 
                    className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                >
                    Voltar para o Início
                </button>
            </div>
        </div>
    );
  }

  const iconIsUrl = isUrl(service.icon);

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark">
      {/* TopAppBar */}
      <header className="shrink-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <button 
          onClick={onBack}
          className="text-[#111318] dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-[#111318] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">Detalhes da Ocorrência</h2>
      </header>
      
      <main className="flex-1 flex flex-col overflow-y-auto pb-6 no-scrollbar">
        {/* Service Header */}
        <div className="px-4 pt-6 pb-2 shrink-0">
          <div className="flex flex-col gap-4">
            <div className="flex gap-5 items-start">
              <div 
                className={`flex items-center justify-center rounded-xl h-24 w-24 shadow-sm shrink-0 border border-gray-200 dark:border-gray-700 ${themeColors.bg} ${iconIsUrl ? '' : themeColors.text} overflow-hidden`} 
              >
                  {iconIsUrl ? (
                      <img src={service.icon} alt="Icon" className="w-full h-full object-contain p-2" />
                  ) : (
                      <span className="material-symbols-outlined text-5xl">{service.icon}</span>
                  )}
              </div>
              <div className="flex flex-col py-1">
                <h1 className="text-[#111318] dark:text-white text-2xl font-bold leading-tight tracking-tight mb-1">{service.title}</h1>
                <p className="text-[#616f89] dark:text-gray-400 text-sm font-medium leading-normal mb-2 uppercase tracking-wide">{service.secretariatId}</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold w-fit">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Disponível Online
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="px-4 py-2 shrink-0">
          <p className="text-[#111318] dark:text-gray-300 text-base font-normal leading-relaxed">
            {service.description}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200 dark:bg-gray-800 mx-4 my-2 shrink-0"></div>

        {/* Request Form */}
        <form className="flex flex-col gap-6 px-4 pt-2 pb-6" onSubmit={(e) => { e.preventDefault(); }}>
            
            {/* 1. Location Field (Conditional) */}
            {service.requiresLocation && (
                <div className="flex flex-col gap-2">
                    <label className={`text-sm font-semibold flex items-center gap-1 ${errors.location ? 'text-red-600 dark:text-red-400' : 'text-[#111318] dark:text-gray-200'}`}>
                        <span className="material-symbols-outlined text-[18px] text-primary">location_on</span>
                        Onde é o problema?
                    </label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                            <span className="material-symbols-outlined">search</span>
                        </div>
                        <input 
                            className={`w-full bg-white dark:bg-gray-800 text-[#111318] dark:text-white placeholder:text-gray-400 border rounded-lg pl-10 pr-10 py-3 focus:outline-none focus:ring-2 transition-all text-sm shadow-sm ${errors.location ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : 'border-gray-300 dark:border-gray-700 focus:ring-primary/50 focus:border-primary'}`} 
                            placeholder="Endereço (Use o mapa ou GPS ou digite)" 
                            type="text" 
                            value={address}
                            onChange={(e) => { setAddress(e.target.value); if(errors.location) setErrors(prev => ({...prev, location: undefined})); }}
                        />
                        <button 
                            type="button"
                            onClick={!isLoadingLocation ? handleGetLocation : undefined}
                            className={`absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer transition-colors ${isLoadingLocation ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                            title="Usar GPS Atual"
                        >
                            {isLoadingLocation ? (
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined">my_location</span>
                            )}
                        </button>
                    </div>
                    
                    {errors.location && (
                        <p className="text-red-500 text-xs font-bold animate-in slide-in-from-top-1">{errors.location}</p>
                    )}

                    {/* Map Preview Container */}
                    <div 
                        className={`w-full h-44 rounded-lg overflow-hidden mt-1 relative border group shadow-sm z-0 bg-gray-100 dark:bg-gray-800 ${errors.location ? 'border-red-300 dark:border-red-900' : 'border-gray-200 dark:border-gray-700'}`}
                        onClick={() => setIsMapModalOpen(true)}
                    >
                        <div id={previewMapContainerId} className="w-full h-full z-0 pointer-events-none"></div>
                        
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer z-10">
                            <div className="bg-white/90 dark:bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 shadow-lg transform translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                                <span className="material-symbols-outlined text-primary text-lg">edit_location_alt</span>
                                <span className="text-sm font-bold text-primary dark:text-white">Ajustar no Mapa</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 ml-1">Clique no alvo para usar o GPS ou no mapa para ajustar o pino manualmente.</p>
                </div>
            )}

            {/* 2. Description Field */}
            <div className="flex flex-col gap-2">
                <label className={`text-sm font-semibold flex items-center gap-1 ${errors.description ? 'text-red-600 dark:text-red-400' : 'text-[#111318] dark:text-gray-200'}`}>
                    <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                    Descrição detalhada
                </label>
                <textarea 
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); if(errors.description) setErrors(prev => ({...prev, description: undefined})); }}
                    className={`w-full bg-white dark:bg-gray-800 text-[#111318] dark:text-white placeholder:text-gray-400 border rounded-lg p-3 focus:outline-none focus:ring-2 transition-all text-sm shadow-sm resize-none ${errors.description ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : 'border-gray-300 dark:border-gray-700 focus:ring-primary/50 focus:border-primary'}`} 
                    placeholder="Descreva o problema com o máximo de detalhes..." 
                    rows={4}
                ></textarea>
                {errors.description && (
                    <p className="text-red-500 text-xs font-bold animate-in slide-in-from-top-1">{errors.description}</p>
                )}
            </div>

            {/* 3. Photo Upload (Conditional) */}
            {service.requiresPhoto && (
                <div className="flex flex-col gap-2">
                    <label className={`text-sm font-semibold flex items-center gap-1 ${errors.photos ? 'text-red-600 dark:text-red-400' : 'text-[#111318] dark:text-gray-200'}`}>
                        <span className="material-symbols-outlined text-[18px] text-primary">photo_camera</span>
                        Evidências (Fotos)
                    </label>
                    
                    {/* Hidden File Input for Gallery */}
                    <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        ref={galleryInputRef}
                        onChange={handleFileChange}
                        className="hidden" 
                    />

                    {/* Hidden File Input for Camera (Direct Capture) */}
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        ref={cameraInputRef}
                        onChange={handleFileChange}
                        className="hidden" 
                    />

                    {/* Buttons Layout */}
                    <div className="flex gap-3 w-full mb-1">
                        <button 
                            type="button"
                            onClick={handleCameraClick}
                            className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed hover:bg-primary/10 dark:hover:bg-primary/20 active:scale-[0.98] transition-all group ${errors.photos ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-primary/40 bg-primary/5 dark:bg-primary/10'}`}
                        >
                            <div className="bg-primary/20 p-2.5 rounded-full text-primary group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl">photo_camera</span>
                            </div>
                            <span className="text-xs font-bold text-primary uppercase tracking-wide">Tirar Foto</span>
                        </button>

                        <button 
                            type="button"
                            onClick={handleGalleryClick}
                            className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.98] transition-all group ${errors.photos ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'}`}
                        >
                            <div className="bg-gray-200 dark:bg-gray-700 p-2.5 rounded-full text-gray-600 dark:text-gray-300 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl">image</span>
                            </div>
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Abrir Galeria</span>
                        </button>
                    </div>
                    {errors.photos && (
                        <p className="text-red-500 text-xs font-bold animate-in slide-in-from-top-1 text-center">{errors.photos}</p>
                    )}

                    {/* Preview Grid */}
                    {photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            {photos.map((photo, index) => (
                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group shadow-sm">
                                    <img 
                                        alt={`Evidence ${index}`} 
                                        className="w-full h-full object-cover" 
                                        src={photo}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => handleRemovePhoto(index)}
                                        className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full p-1 backdrop-blur-sm transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </form>
      </main>

      {/* Sticky Footer Action */}
      <div className="shrink-0 w-full bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 p-4 pb-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
         <div className="w-full">
            <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full bg-primary hover:bg-blue-600 text-white font-bold text-base py-3.5 px-6 rounded-lg shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
                {isSubmitting ? (
                    <>
                        <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                        <span>{uploadProgress || 'Enviando...'}</span>
                    </>
                ) : (
                    <>
                        <span>Enviar Solicitação</span>
                        <span className="material-symbols-outlined text-[20px]">send</span>
                    </>
                )}
            </button>
         </div>
      </div>

      {/* Interactive Map Picker Modal */}
      {isMapModalOpen && (
        <div className="absolute inset-0 z-[60] bg-white dark:bg-background-dark flex flex-col animate-in slide-in-from-bottom-full duration-300">
             <header className="shrink-0 flex items-center p-4 justify-between bg-white dark:bg-background-dark shadow-sm z-10">
                <button 
                    onClick={() => setIsMapModalOpen(false)}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-gray-800 dark:text-white">close</span>
                </button>
                <div className="flex flex-col items-center">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-none">Ajustar Localização</h3>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">Arraste o alfinete para o local exato</span>
                </div>
                <div className="w-10"></div>
            </header>
            
            <div className="flex-1 relative bg-gray-100 dark:bg-gray-900">
                <div id={modalMapContainerId} className="w-full h-full z-0"></div>
                <div className="absolute bottom-6 right-6 z-[400]">
                    <button 
                        onClick={handleGetLocation}
                        className="bg-white dark:bg-slate-800 text-primary p-4 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center"
                    >
                         {isLoadingLocation ? (
                             <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
                        ) : (
                             <span className="material-symbols-outlined text-[28px]">my_location</span>
                        )}
                    </button>
                </div>
            </div>

            <div className="p-4 bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 z-10">
                <div className="mb-3 px-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Endereço selecionado:</p>
                    <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{address || "Nenhum local selecionado"}</p>
                </div>
                <button 
                    onClick={() => setIsMapModalOpen(false)}
                    className="w-full bg-primary hover:bg-blue-600 text-white font-bold text-base py-3.5 px-6 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">check</span>
                    <span>Confirmar Localização</span>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default ServiceDetailsScreen;
