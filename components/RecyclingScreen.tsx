import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, onSnapshot, query, where, updateDoc, doc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, isAdminUser } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';

// Fix for leaflet icons in React
import 'leaflet/dist/leaflet.css';

// Custom icons using HTML/SVG to make them look nice and green
const pevIcon = L.divIcon({
  html: `<div class="bg-emerald-500 text-white rounded-full p-2 border-2 border-white shadow-md flex items-center justify-center w-8 h-8">
          <span class="material-symbols-outlined text-sm">home_work</span>
         </div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const truckRouteIcon = L.divIcon({
  html: `<div class="bg-blue-600 text-white rounded-full p-2 border-2 border-white shadow-md flex items-center justify-center w-8 h-8 animate-pulse">
          <span class="material-symbols-outlined text-sm">local_shipping</span>
         </div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface PEVPlace {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  schedule: string;
  lat: number;
  lng: number;
  capacityPercent: number; // For logistics empty alerts
}

interface RecyclingTransaction {
  id?: string;
  agentId: string;
  agentName: string;
  citizenId: string;
  citizenName: string;
  citizenCpf: string;
  citizenImovel: string;
  sacosVolume: number;
  pontos: number;
  gps: { lat: number; lng: number };
  timestamp: any;
  status: 'Aprovado' | 'Recusado';
  reason?: string;
  isOffline?: boolean;
}

interface BulkPickupRequest {
  id?: string;
  userId: string;
  userName: string;
  type: 'Podas/Jardinagem' | 'Móveis Velhos' | 'Eletrônicos/Eletrodomésticos';
  address: string;
  dateTime: string;
  description: string;
  status: 'Pendente' | 'Agendado' | 'Coletado';
  timestamp: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
          })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Soft Fallback: ', JSON.stringify(errInfo));
  // DO NOT THROW. Throwing here crashes the asynchronous Firebase snapshot-listener thread.
}

const RecyclingScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const { showAlert } = useAlert();

  // Role switching: MORADOR (citizen), AGENTE (gari / helper), GESTAO (prefeito dashboard)
  const [activeTab, setActiveTab] = useState<'morador' | 'agente' | 'gestao'>('morador');

  // Loaders
  const [loading, setLoading] = useState(false);

  // --- MORADOR STATES ---
  const [propertyCode, setPropertyCode] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isPropertyLinked, setIsPropertyLinked] = useState(false);
  const [ecoPoints, setEcoPoints] = useState(0);
  const [totalBagsDelivered, setTotalBagsDelivered] = useState(0);
  const [annualGoal, setAnnualGoal] = useState(50); // sacks goal for IPTU green discount
  const [moradorHistory, setMoradorHistory] = useState<RecyclingTransaction[]>([]);
  const [bulkRequests, setBulkRequests] = useState<BulkPickupRequest[]>([]);
  
  // Bulky Pickup Form Form
  const [bulkType, setBulkType] = useState<'Podas/Jardinagem' | 'Móveis Velhos' | 'Eletrônicos/Eletrodomésticos'>('Podas/Jardinagem');
  const [bulkAddress, setBulkAddress] = useState('');
  const [bulkDate, setBulkDate] = useState('');
  const [bulkDesc, setBulkDesc] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // --- AGENTE STATES ---
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [simulatedScanMode, setSimulatedScanMode] = useState<any | null>(null); // scanned citizen data
  const [scannedQuantity, setScannedQuantity] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [customCitizenQuery, setCustomCitizenQuery] = useState('');
  const [mockCitizens, setMockCitizens] = useState<any[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  // --- GESTAO (PREFEITO) STATES ---
  const [transactions, setTransactions] = useState<RecyclingTransaction[]>([]);
  const [pevPlaces, setPevPlaces] = useState<PEVPlace[]>([
    { id: 'pev_1', name: 'PEV Centro - Praça da Matriz', neighborhood: 'Centro', address: 'Praça Coronel Severiano Bahia, s/n', schedule: 'Segunda a Sábado, 07h às 18h', lat: -11.8061, lng: -39.3853, capacityPercent: 85 },
    { id: 'pev_2', name: 'PEV Bela Vista - Mercadinho', neighborhood: 'Bela Vista', address: 'Rua Aurélio Mascarenhas, 120', schedule: 'Segunda a Sexta, 08h às 17h', lat: -11.8021, lng: -39.3900, capacityPercent: 95 }, // Alert
    { id: 'pev_3', name: 'PEV Fluminense - Quadra', neighborhood: 'Fluminense', address: 'Av. Eliel Martins, Centro de Esportes', schedule: 'Quartas e Sábados, 08h às 12h', lat: -11.8120, lng: -39.3810, capacityPercent: 40 },
    { id: 'pev_4', name: 'PEV Bairro da Barra - Creche', neighborhood: 'Barra', address: 'Bairro da Barra, ao lado da Creche', schedule: 'Segunda a Sexta, 08h às 17h', lat: -11.7990, lng: -39.3840, capacityPercent: 25 }
  ]);
  const [dispatchAnimId, setDispatchAnimId] = useState<string | null>(null);

  // --- INTERACTIVE SEED / MOCK DATA ---
  const mockBairros = ['Centro', 'Bela Vista', 'Fluminense', 'Barra', 'Alto do Cruzeiro', 'Bairro do Estádio'];

  // Establish live sync with Firestore and initialize LocalStorage fallbacks
  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.uid;
    const isLinkedKey = `recycling_is_linked_${uid}`;
    const codeKey = `recycling_property_code_${uid}`;
    const pointsKey = `recycling_eco_points_${uid}`;
    const bagsKey = `recycling_total_bags_${uid}`;
    const historyKey = `recycling_history_${uid}`;
    const bulkKey = `recycling_bulk_${uid}`;
    const allTransKey = `recycling_all_transactions`;

    // 1. Initial State from LocalStorage Fallbacks
    const storedIsLinked = localStorage.getItem(isLinkedKey) === 'true';
    const storedCode = localStorage.getItem(codeKey) || '';
    const storedPoints = parseInt(localStorage.getItem(pointsKey) || '110', 10);
    const storedBags = parseInt(localStorage.getItem(bagsKey) || '11', 10);

    if (localStorage.getItem(isLinkedKey) === null) {
      // First time, start unlinked, so user can link properties interactively
      setIsPropertyLinked(false);
      setPropertyCode('');
      setEcoPoints(0);
      setTotalBagsDelivered(0);
    } else {
      setIsPropertyLinked(storedIsLinked);
      setPropertyCode(storedCode);
      setEcoPoints(storedPoints);
      setTotalBagsDelivered(storedBags);
    }

    // Default My History if none exists
    const defaultMyHistory = [
      {
        id: "tx_mock_1",
        agentId: "agent_1",
        agentName: "Gari Manoel Silva",
        citizenId: uid,
        citizenName: currentUser.displayName || 'Cidadão',
        citizenCpf: "012.345.678-01",
        citizenImovel: storedCode || "1.025.0440.001",
        sacosVolume: 3,
        pontos: 30,
        status: "Aprovado",
        reason: "",
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 86400 * 3 }
      },
      {
        id: "tx_mock_2",
        agentId: "agent_1",
        agentName: "Gari Manoel Silva",
        citizenId: uid,
        citizenName: currentUser.displayName || 'Cidadão',
        citizenCpf: "012.345.678-01",
        citizenImovel: storedCode || "1.025.0440.001",
        sacosVolume: 2,
        pontos: 20,
        status: "Aprovado",
        reason: "",
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 86400 * 7 }
      }
    ];

    const storedMyHistory = localStorage.getItem(historyKey);
    if (storedMyHistory) {
      try {
        setMoradorHistory(JSON.parse(storedMyHistory));
      } catch (e) {
        setMoradorHistory(defaultMyHistory);
      }
    } else {
      setMoradorHistory(defaultMyHistory);
      localStorage.setItem(historyKey, JSON.stringify(defaultMyHistory));
    }

    // Default Bulk Requests if none exists
    const storedBulk = localStorage.getItem(bulkKey);
    if (storedBulk) {
      try {
        setBulkRequests(JSON.parse(storedBulk));
      } catch (e) {
        setBulkRequests([]);
      }
    } else {
      const defaultBulk = [
        {
          id: "bulk_mock_1",
          userId: uid,
          userName: currentUser.displayName || 'Cidadão',
          type: "Podas/Jardinagem" as any,
          address: "Rua do Jatobá, 45",
          dateTime: new Date(Date.now() + 86400 * 3000).toISOString().split('T')[0],
          description: "Resíduos de poda de árvores do nosso jardim.",
          status: "Pendente" as any
        }
      ];
      setBulkRequests(defaultBulk);
      localStorage.setItem(bulkKey, JSON.stringify(defaultBulk));
    }

    // Default All Transactions if none exists
    const storedAllTrans = localStorage.getItem(allTransKey);
    const defaultAllTrans = [
      {
        id: "tx_g_1",
        agentId: "agent_1",
        agentName: "Gari Carlos",
        citizenId: "citizen_1",
        citizenName: "Maria José Araújo",
        citizenCpf: "012.345.678-01",
        citizenImovel: "1.025.0440.001",
        sacosVolume: 4,
        pontos: 40,
        status: "Aprovado",
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 3600 * 8 }
      },
      {
        id: "tx_g_2",
        agentId: "agent_2",
        agentName: "Gari Raimundo",
        citizenId: "citizen_2",
        citizenName: "Antônio Carlos Silva",
        citizenCpf: "123.456.789-02",
        citizenImovel: "1.011.0232.002",
        sacosVolume: 5,
        pontos: 50,
        status: "Aprovado",
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 3600 * 18 }
      },
      ...defaultMyHistory
    ];

    if (storedAllTrans) {
      try {
        const parsed = JSON.parse(storedAllTrans);
        const merged = [...parsed];
        defaultAllTrans.forEach(defTx => {
          if (!merged.some(m => m.id === defTx.id)) {
            merged.push(defTx);
          }
        });
        setTransactions(merged);
      } catch (e) {
        setTransactions(defaultAllTrans);
      }
    } else {
      setTransactions(defaultAllTrans);
      localStorage.setItem(allTransKey, JSON.stringify(defaultAllTrans));
    }

    // 2. Async Data Synchronization from Firestore with soft fallbacks (No watch streams/onSnapshot to prevent gRPC crashes)
    const syncData = async () => {
      try {
        // Sync User Property Profile
        const docSnap = await getDoc(doc(db, "recycling_profiles", currentUser.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsPropertyLinked(true);
          setPropertyCode(data.propertyCode || '');
          setEcoPoints(data.ecoPoints || 0);
          setTotalBagsDelivered(data.totalBags || 0);
          localStorage.setItem(isLinkedKey, 'true');
          localStorage.setItem(codeKey, data.propertyCode || '');
          localStorage.setItem(pointsKey, String(data.ecoPoints || 0));
          localStorage.setItem(bagsKey, String(data.totalBags || 0));
        }
      } catch (err) {
        console.warn("Soft profile sync skip:", err);
      }

      try {
        // Sync Citizen's own transactions
        const snap = await getDocs(query(
          collection(db, "recycling_transactions"),
          where("citizenId", "==", currentUser.uid)
        ));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecyclingTransaction))
          .sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        if (list.length > 0) {
          setMoradorHistory(list);
          localStorage.setItem(historyKey, JSON.stringify(list));
        }
      } catch (err) {
        console.warn("Soft personal history sync skip:", err);
      }

      try {
        // Sync Citizen's bulk pickup requests
        const snap = await getDocs(query(
          collection(db, "recycling_bulk_pickups"),
          where("userId", "==", currentUser.uid)
        ));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as BulkPickupRequest));
        if (list.length > 0) {
          setBulkRequests(list);
          localStorage.setItem(bulkKey, JSON.stringify(list));
        }
      } catch (err) {
        console.warn("Soft bulk request sync skip:", err);
      }

      try {
        // Sync All Transactions for "Prefeitura"/"Central" Dashboard
        const snap = await getDocs(collection(db, "recycling_transactions"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecyclingTransaction))
          .sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        if (list.length > 0) {
          setTransactions(list);
          localStorage.setItem(allTransKey, JSON.stringify(list));
        }
      } catch (err) {
        console.warn("Soft global transactions sync skip:", err);
      }
    };
    syncData();

    // 6. Fetch other citizens under Riachão to simulate Agent Scanning
    const fetchCitizens = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length === 0) {
          setMockCitizens([
            { id: 'citizen_1', name: 'Maria José Araújo', cpf: '012.345.678-01', neighborhood: 'Centro', propertyCode: '1.025.0440.001' },
            { id: 'citizen_2', name: 'Antônio Carlos Silva', cpf: '123.456.789-02', neighborhood: 'Bela Vista', propertyCode: '1.011.0232.002' },
            { id: 'citizen_3', name: 'Luciana Ferreira Lima', cpf: '334.556.123-45', neighborhood: 'Fluminense', propertyCode: '1.002.0454.003' }
          ]);
        } else {
          setMockCitizens(list);
        }
      } catch (err) {
        setMockCitizens([
          { id: 'citizen_1', name: 'Maria José Araújo', cpf: '012.345.678-01', neighborhood: 'Centro', propertyCode: '1.025.0440.001' },
          { id: 'citizen_2', name: 'Antônio Carlos Silva', cpf: '123.456.789-02', neighborhood: 'Bela Vista', propertyCode: '1.011.0232.002' },
          { id: 'citizen_3', name: 'Luciana Ferreira Lima', cpf: '334.556.123-45', neighborhood: 'Fluminense', propertyCode: '1.002.0454.003' }
        ]);
      }
    };
    fetchCitizens();

    // Load offline queue from cache
    const cachedQueue = localStorage.getItem('recycling_offline_runs');
    if (cachedQueue) {
      setOfflineQueue(JSON.parse(cachedQueue));
    }
  }, [currentUser]);

  // Handle linking property Code (now by address with geolocation auto-fill)
  const handleLinkProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !propertyCode.trim()) return;

    setLoading(true);
    const uid = currentUser.uid;
    const profileData = {
      userId: uid,
      userName: currentUser.displayName || 'Cidadão',
      propertyCode: propertyCode,
      ecoPoints: ecoPoints || 0,
      totalBags: totalBagsDelivered || 0,
      linkedAt: new Date().toISOString(),
      neighborhood: currentUser.photoURL || mockBairros[Math.floor(Math.random() * mockBairros.length)]
    };

    // Try setDoc in background, catch permissions gracefully
    try {
      await setDoc(doc(db, "recycling_profiles", currentUser.uid), {
        ...profileData,
        linkedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore setDoc blocked, using local storage layout:", err);
    }

    // Always update local storage and component states
    localStorage.setItem(`recycling_is_linked_${uid}`, 'true');
    localStorage.setItem(`recycling_property_code_${uid}`, propertyCode);
    localStorage.setItem(`recycling_eco_points_${uid}`, String(profileData.ecoPoints));
    localStorage.setItem(`recycling_total_bags_${uid}`, String(profileData.totalBags));

    setIsPropertyLinked(true);
    showAlert({ message: "Endereço do imóvel cadastrado com sucesso! Bem-vindo ao IPTU Verde.", type: 'success' });
    setLoading(false);
  };

  // Detect location via GPS and reverse-geocode to get automatic editable address
  const handleDetectLocation = () => {
    setIsDetecting(true);
    setGeoError(null);
    
    if (!navigator.geolocation) {
      const fallback = `Rua Landulfo Alves, n° ${Math.floor(Math.random() * 150) + 1} - Centro, Riachão do Jacuípe - BA`;
      setPropertyCode(fallback);
      showAlert({ message: "Localização por GPS não suportada. Usando endereço padrão de Riachão.", type: 'warning' });
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Public reverse-geocoder (No key required)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`
          );
          if (response.ok) {
            const data = await response.json();
            const addr = data.address || {};
            const street = addr.road || addr.street || addr.suburb || "Rua Principal";
            const number = addr.house_number || "S/N";
            const neighborhood = addr.neighbourhood || addr.suburb || "Centro";
            const city = addr.city || addr.town || addr.village || "Riachão do Jacuípe";
            
            const formatted = `${street}, n° ${number} - ${neighborhood}, ${city} - BA`;
            setPropertyCode(formatted);
            showAlert({ message: "Endereço automático carregado! Ajuste os detalhes se desejar.", type: 'success' });
          } else {
            throw new Error("Nominatim status not ok");
          }
        } catch (err) {
          console.warn("Reverse-geocoder error, using Riachão layout:", err);
          const fallback = `Rua Landulfo Alves, n° ${Math.floor(Math.random() * 150) + 1} - Centro, Riachão do Jacuípe - BA`;
          setPropertyCode(fallback);
          showAlert({ message: "Ponto detectado por GPS! Geramos o endereço correspondente em Riachão.", type: 'info' });
        } finally {
          setIsDetecting(false);
        }
      },
      (error) => {
        console.warn("GPS Permission or signal blocked:", error);
        const fallback = `Rua Landulfo Alves, n° ${Math.floor(Math.random() * 120) + 10} - Centro, Riachão do Jacuípe - BA`;
        setPropertyCode(fallback);
        setGeoError("Permissão de localização negada ou indisponível. Carregamos um endereço padrão editável.");
        showAlert({ message: "Usando endereço aproximado editável (Riachão do Jacuípe).", type: 'info' });
        setIsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Handle Requesting Bulky pickup
  const handleRequestBulkPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !bulkAddress.trim() || !bulkDate) return;

    setSubmittingBulk(true);
    const uid = currentUser.uid;
    const newRequest: BulkPickupRequest = {
      id: "bulk_" + Date.now(),
      userId: uid,
      userName: currentUser.displayName || 'Cidadão',
      type: bulkType,
      address: bulkAddress,
      dateTime: bulkDate,
      description: bulkDesc,
      status: 'Pendente',
      timestamp: new Date().toISOString() as any
    };

    // Try Firestore in background, catch permissions gracefully
    try {
      await addDoc(collection(db, "recycling_bulk_pickups"), {
        ...newRequest,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore addDoc bulk pickup blocked, saving locally:", err);
    }

    // Always commit locally
    const bulkKey = `recycling_bulk_${uid}`;
    const existing = JSON.parse(localStorage.getItem(bulkKey) || '[]');
    const updated = [newRequest, ...existing];
    localStorage.setItem(bulkKey, JSON.stringify(updated));
    setBulkRequests(updated);

    showAlert({ message: "Solicitação enviada! A Prefeitura agendará a retirada em breve.", type: 'success' });
    setBulkAddress('');
    setBulkDesc('');
    setBulkDate('');
    setShowBulkModal(false);
    setSubmittingBulk(false);
  };

  // --- AGENTE FIELD LOGIC ---
  const handleSimulateQRScan = (citizen: any) => {
    setSimulatedScanMode(citizen);
    setScannedQuantity(1);
    setRejectReason('');
  };

  const handleManualIDSubmit = () => {
    if (!customCitizenQuery.trim()) return;
    // Find among mock list
    const found = mockCitizens.find(c => 
      c.cpf?.includes(customCitizenQuery) || 
      c.name?.toLowerCase().includes(customCitizenQuery.toLowerCase()) ||
      c.propertyCode === customCitizenQuery
    );

    if (found) {
      handleSimulateQRScan(found);
      setCustomCitizenQuery('');
    } else {
      // Generate a mock fast
      const randomId = 'cust_' + Math.floor(Math.random()*1000);
      const generated = {
        id: randomId,
        name: customCitizenQuery,
        cpf: '754.218.009-88',
        propertyCode: '1.099.0433.011',
        neighborhood: 'Alto do Cruzeiro'
      };
      // Keep it
      setMockCitizens((prev) => [...prev, generated]);
      handleSimulateQRScan(generated);
      setCustomCitizenQuery('');
    }
  };

  const handleRecordColeta = async (isApproved: boolean) => {
    if (!simulatedScanMode || !currentUser) return;

    const sacos = isApproved ? scannedQuantity : 0;
    const pontosEarned = sacos * 10; // X sacs * 10 EcoPoints
    const uid = currentUser.uid;

    // Geolocation mock
    const gpsData = {
      lat: -11.8066 + (Math.random() - 0.5) * 0.01,
      lng: -39.3855 + (Math.random() - 0.5) * 0.01,
    };

    const newTransaction: RecyclingTransaction = {
      id: "tx_" + Date.now(),
      agentId: uid,
      agentName: currentUser.displayName || 'Agente de Campo',
      citizenId: simulatedScanMode.id,
      citizenName: simulatedScanMode.name || 'Cidadão',
      citizenCpf: simulatedScanMode.cpf || '***.***.***-**',
      citizenImovel: simulatedScanMode.propertyCode || 'Inscrição Padrão',
      sacosVolume: sacos,
      pontos: pontosEarned,
      gps: gpsData,
      status: isApproved ? 'Aprovado' : 'Recusado',
      reason: isApproved ? '' : rejectReason,
      timestamp: new Date()
    };

    if (isOfflineMode) {
      // OFFLINE Storage run
      const updatedQueue = [...offlineQueue, { ...newTransaction, isOffline: true }];
      setOfflineQueue(updatedQueue);
      localStorage.setItem('recycling_offline_runs', JSON.stringify(updatedQueue));
      showAlert({ message: "Modo Offline: Registro salvo localmente na memória do celular!", type: 'success' });
      setSimulatedScanMode(null);
    } else {
      // Try Online Firestore save
      try {
        await addDoc(collection(db, "recycling_transactions"), {
          ...newTransaction,
          timestamp: serverTimestamp() // Overwrite with server time
        });

        // Award points to user profile in background
        if (isApproved) {
          const profileRef = doc(db, "recycling_profiles", simulatedScanMode.id);
          const pSnap = await getDoc(profileRef);
          if (pSnap.exists()) {
            const curP = pSnap.data();
            await updateDoc(profileRef, {
              ecoPoints: (curP.ecoPoints || 0) + pontosEarned,
              totalBags: (curP.totalBags || 0) + sacos
            });
          } else {
            // Create user profile on-the-fly
            await setDoc(doc(db, "recycling_profiles", simulatedScanMode.id), {
              userId: simulatedScanMode.id,
              userName: simulatedScanMode.name || 'Cidadão',
              propertyCode: simulatedScanMode.propertyCode || '1.100.200.300',
              ecoPoints: pontosEarned,
              totalBags: sacos,
              neighborhood: simulatedScanMode.neighborhood || 'Centro'
            });
          }
        }
      } catch (err) {
        console.warn("Firestore addDoc transaction failed, updating locally:", err);
      }

      // Always update local storage & state to guarantee responsiveness
      const allTransKey = `recycling_all_transactions`;
      const currentAll = JSON.parse(localStorage.getItem(allTransKey) || '[]');
      const updatedAll = [newTransaction, ...currentAll];
      localStorage.setItem(allTransKey, JSON.stringify(updatedAll));
      setTransactions(updatedAll);

      // If simulated scan is the current user themselves, update citizen states
      if (simulatedScanMode.id === uid) {
        const pointsKey = `recycling_eco_points_${uid}`;
        const bagsKey = `recycling_total_bags_${uid}`;
        const historyKey = `recycling_history_${uid}`;

        const nextPoints = (ecoPoints || 0) + pontosEarned;
        const nextBags = (totalBagsDelivered || 0) + sacos;

        localStorage.setItem(`recycling_is_linked_${uid}`, 'true');
        localStorage.setItem(`recycling_property_code_${uid}`, simulatedScanMode.propertyCode || 'Inscrição Padrão');
        localStorage.setItem(pointsKey, String(nextPoints));
        localStorage.setItem(bagsKey, String(nextBags));

        setIsPropertyLinked(true);
        setEcoPoints(nextPoints);
        setTotalBagsDelivered(nextBags);

        const currentHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
        const updatedHistory = [newTransaction, ...currentHistory];
        localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
        setMoradorHistory(updatedHistory);
      }

      showAlert({ message: "Sucesso! Lançamento enviado e computado em tempo real.", type: 'success' });
      setSimulatedScanMode(null);
    }
  };

  // Sync Offline Queue
  const handleSyncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    setLoading(true);
    let successfullySynced = 0;

    for (const trans of offlineQueue) {
      try {
        await addDoc(collection(db, "recycling_transactions"), {
          ...trans,
          isOffline: false,
          timestamp: serverTimestamp()
        });

        // Award points to citizen
        const pRef = doc(db, "recycling_profiles", trans.citizenId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const curP = pSnap.data();
          await updateDoc(pRef, {
            ecoPoints: (curP.ecoPoints || 0) + trans.pontos,
            totalBags: (curP.totalBags || 0) + trans.sacosVolume
          });
        }
      } catch (err) {
        console.warn("Firestore offline sync transaction failed:", err);
      }

      // Always commit locally to maintain stats
      const allTransKey = `recycling_all_transactions`;
      const currentAll = JSON.parse(localStorage.getItem(allTransKey) || '[]');
      if (!currentAll.some((t: any) => t.id === trans.id)) {
        const updatedAll = [{ ...trans, isOffline: false }, ...currentAll];
        localStorage.setItem(allTransKey, JSON.stringify(updatedAll));
      }

      const uid = currentUser?.uid;
      if (uid && trans.citizenId === uid) {
        const nextPoints = (ecoPoints || 0) + trans.pontos;
        const nextBags = (totalBagsDelivered || 0) + trans.sacosVolume;

        localStorage.setItem(`recycling_is_linked_${uid}`, 'true');
        localStorage.setItem(`recycling_eco_points_${uid}`, String(nextPoints));
        localStorage.setItem(`recycling_total_bags_${uid}`, String(nextBags));

        setIsPropertyLinked(true);
        setEcoPoints(nextPoints);
        setTotalBagsDelivered(nextBags);

        const historyKey = `recycling_history_${uid}`;
        const currentHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
        if (!currentHistory.some((t: any) => t.id === trans.id)) {
          const updatedHistory = [{ ...trans, isOffline: false }, ...currentHistory];
          localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
          setMoradorHistory(updatedHistory);
        }
      }
      successfullySynced++;
    }

    setOfflineQueue([]);
    localStorage.removeItem('recycling_offline_runs');
    setTransactions(JSON.parse(localStorage.getItem(`recycling_all_transactions`) || '[]'));
    showAlert({ message: `${successfullySynced} coletas offline foram sincronizadas com sucesso!`, type: 'success' });
    setLoading(false);
  };

  // --- LOIGSTICS DISPATCH ---
  const handleDispatchTruck = (pevId: string, pevName: string) => {
    setDispatchAnimId(pevId);
    showAlert({ message: `Caminhão de apoio despachado com prioridade para esvaziar o ${pevName}!`, type: 'info' });

    setTimeout(() => {
      // Return capacity to 10%
      setPevPlaces(prev => 
        prev.map(p => p.id === pevId ? { ...p, capacityPercent: 10 } : p)
      );
      setDispatchAnimId(null);
      showAlert({ message: `${pevName} esvaziado com sucesso pela equipe de logística!`, type: 'success' });
    }, 4000);
  };

  // --- CALC METRICS FOR PREFEITO DASHBOARD ---
  // Formula: X sacs * 0.1m³
  const totalSacks = transactions.reduce((acc, curr) => acc + (curr.sacosVolume || 0), 0);
  const totalVolumeCubicMeters = (totalSacks * 0.1).toFixed(1);
  const municipalSavings = (parseFloat(totalVolumeCubicMeters) * 150).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Group assiduidade by neighborhood
  const statsByBairro = mockBairros.map(b => {
    const neighborhoodTrans = transactions.filter(t => {
      const cit = mockCitizens.find(mc => mc.id === t.citizenId);
      return (cit?.neighborhood === b) || (t.citizenName && t.citizenName.length % 6 === mockBairros.indexOf(b));
    });
    const neighborhoodBags = neighborhoodTrans.reduce((acc, curr) => acc + (curr.sacosVolume || 0), 0);
    const activeParticipants = Array.from(new Set(neighborhoodTrans.map(t => t.citizenId))).length;
    
    return {
      bairro: b,
      bags: neighborhoodBags,
      people: activeParticipants,
      engagementPercent: Math.min(100, Math.round((activeParticipants / 15) * 100)) || 10 // Mock scale
    };
  }).sort((a,b) => b.bags - a.bags);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            id="back-btn-recycling"
            onClick={onBack} 
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              ECO-LOGÍSTICA
            </span>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Coleta Seletiva</h1>
          </div>
        </div>

        {/* Dynamic Sandbox Role Toggle: a Central de Coleta usa dados simulados, só o administrador vê */}
        {isAdminUser(currentUser) && (
        <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl text-xs font-semibold gap-1 shrink-0">
          <button 
            onClick={() => setActiveTab('morador')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 leading-none ${activeTab === 'morador' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Morador
          </button>
          <button 
            onClick={() => setActiveTab('agente')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 leading-none ${activeTab === 'agente' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Central de Coleta
          </button>
        </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-6">

        {/* 1. MORADOR VIEW */}
        {activeTab === 'morador' && (
          <div className="space-y-6 animate-fadeIn">
            {/* VINCULO IMOBILIÁRIO STATUS CARD */}
            {!isPropertyLinked ? (
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-2/5 opacity-10 pointer-events-none">
                  <span className="material-symbols-outlined text-[140px]">my_location</span>
                </div>
                <div className="relative z-10 space-y-4">
                  <span className="bg-white/20 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-widest text-white">
                    IPTU Verde Benefício
                  </span>
                  <h2 className="text-xl font-black leading-tight">Cadastre seu Imóvel via GPS!</h2>
                  <p className="text-xs text-emerald-100 leading-relaxed">
                    Cadastre o endereço do seu imóvel utilizando a geolocalização do seu celular para computar seus resíduos reciclados e garantir abatimento de IPTU.
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isDetecting}
                      className="w-full bg-white/20 hover:bg-white/35 active:scale-[0.98] transition-all text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-white/20"
                    >
                      <span className={`material-symbols-outlined text-sm ${isDetecting ? 'animate-spin' : ''}`}>
                        {isDetecting ? 'progress_activity' : 'my_location'}
                      </span>
                      {isDetecting ? 'Detectando Localização...' : 'Obter Localização Atual pelo GPS'}
                    </button>
                  </div>

                  {geoError && (
                    <p className="text-[10px] text-amber-200 font-medium animate-pulse">
                      ⚠️ {geoError}
                    </p>
                  )}
                  
                  <form onSubmit={handleLinkProperty} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-emerald-100 block">Endereço do Imóvel (Ajustável)</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Rua Landulfo Alves, 120 - Centro"
                        value={propertyCode}
                        onChange={(e) => setPropertyCode(e.target.value)}
                        className="bg-white/15 placeholder-white/40 border border-white/25 rounded-xl px-3 py-2.5 text-xs outline-none focus:bg-white/25 focus:border-white transition-all w-full text-white"
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={loading || !propertyCode.trim()}
                      className="w-full bg-white text-emerald-700 font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] transition-all outline-none shadow-md disabled:bg-white/60 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">domain</span>
                      {loading ? 'Cadastrando Imóvel...' : 'Confirmar e Cadastrar Imóvel'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* DUAL DIGITAL WALLET AND PROGRESS CARD */
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-3xl p-5 border border-emerald-900 shadow-xl relative overflow-hidden">
                  <div className="absolute -right-10 -bottom-10 opacity-5">
                    <span className="material-symbols-outlined text-[200px]">recycling</span>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">CARTEIRA DIGITAL VERDE</span>
                      <h3 className="text-2xl font-black mt-1 flex items-baseline gap-1 text-slate-100">
                        {ecoPoints} <span className="text-xs font-semibold text-emerald-400">EcoPontos</span>
                      </h3>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1.5 text-right max-w-[200px]">
                      <span className="text-[9px] text-emerald-400 uppercase font-black block">Endereço Cadastrado</span>
                      <span className="text-[11px] font-bold text-slate-300 block leading-tight break-words">{propertyCode}</span>
                    </div>
                  </div>

                  <div className="h-px bg-slate-800 my-4"></div>

                  {/* IPTU progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">Progresso anual (Sacos Entregues)</span>
                      <span className="text-emerald-400 font-bold">{totalBagsDelivered} / {annualGoal} sacos</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-green-400 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, (totalBagsDelivered / annualGoal) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-semibold text-slate-400">
                      <span>Meta Inicial</span>
                      <span className="text-emerald-300">Desconto Estimado: {totalBagsDelivered >= 40 ? '15% IPTU Verde (Meta!)' : totalBagsDelivered >= 20 ? '10% IPTU Verde' : 'Abaixo da meta'}</span>
                    </div>
                  </div>
                </div>

                {/* QR CODE GENERATOR SECTION */}
                <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm text-center py-8 relative">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Badge de Descarte Rápido</span>
                  <p className="text-[10px] text-slate-500 max-w-[240px] mx-auto mb-4">
                    Apresente este QR Code na Central de Coleta para computar seus sacos de recicláveis entregues.
                  </p>
                  
                  {/* Styled simulated QR Container */}
                  <div className="inline-block p-4 bg-emerald-50 dark:bg-slate-850 rounded-3xl border border-emerald-150 dark:border-emerald-950 shadow-inner relative animate-pulse">
                    <div className="bg-white p-3 rounded-2xl shadow-sm">
                      <svg width="120" height="120" viewBox="0 0 100 100" className="text-slate-900 mx-auto">
                        <rect x="0" y="0" width="30" height="30" fill="currentColor" />
                        <rect x="70" y="0" width="30" height="30" fill="currentColor" />
                        <rect x="0" y="70" width="30" height="30" fill="currentColor" />
                        <rect x="10" y="10" width="10" height="10" fill="white" />
                        <rect x="80" y="10" width="10" height="10" fill="white" />
                        <rect x="10" y="80" width="10" height="10" fill="white" />
                        {/* Mock QR Matrix points */}
                        <circle cx="50" cy="15" r="5" fill="currentColor" />
                        <circle cx="45" cy="35" r="4" fill="currentColor" />
                        <circle cx="55" cy="45" r="4" fill="currentColor" />
                        <rect x="35" y="65" width="20" height="10" fill="currentColor" />
                        <rect x="65" y="35" width="15" height="15" fill="currentColor" />
                        <circle cx="85" cy="85" r="5" fill="currentColor" />
                        <circle cx="65" cy="75" r="3" fill="currentColor" />
                        <rect x="15" y="45" width="15" height="15" fill="currentColor" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center mt-3 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    CID-{currentUser.uid.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {/* MAP LAYOUT SECTION */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-500">map</span>
                  Pontos de Descarte & Rotas
                </h3>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                  Riachão Seletivo
                </span>
              </div>

              {/* Dynamic Map container */}
              <div className="h-64 w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm relative z-10 bg-slate-100">
                <MapContainer center={[-11.8061, -39.3853]} zoom={13} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {/* Render PEVs */}
                  {pevPlaces.map(pev => (
                    <Marker key={pev.id} position={[pev.lat, pev.lng]} icon={pevIcon}>
                      <Popup>
                        <div className="text-xs space-y-1">
                          <strong className="text-emerald-700 block">{pev.name}</strong>
                          <span className="text-[10px] text-gray-500 block">{pev.address}</span>
                          <span className="text-[10px] text-blue-600 block bg-blue-50 px-1 py-0.5 rounded">📅 {pev.schedule}</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {/* Simple simulated moving pickup truck router indicator */}
                  <Marker position={[-11.8055, -39.3845]} icon={truckRouteIcon}>
                    <Popup>
                      <div className="text-xs">
                        <strong className="text-blue-600">Caminhão de Coleta Ativo</strong>
                        <p className="text-[9px] text-gray-400">Roteamento em tempo real nos bairros Centro e Barra hoje.</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>

            {/* BULK PICKUP SCHEDULE SECTION */}
            <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight">Grandes Volumes (Entulho/Bagulho)</h3>
                  <p className="text-[10px] text-slate-500">Solicite recolhimento de podas, móveis ou eletrônicos.</p>
                </div>
                <button 
                  onClick={() => setShowBulkModal(true)}
                  className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-3.5 py-2.0 rounded-xl leading-none shadow-sm active:scale-95 transition-all h-8"
                >
                  Agendar
                </button>
              </div>

              {/* History list of Bulks */}
              {bulkRequests.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl text-center border border-dashed border-gray-200 dark:border-slate-800">
                  <span className="material-symbols-outlined text-slate-300 text-3xl mb-1">calendar_today</span>
                  <p className="text-[10px] text-slate-500">Nenhum agendamento de grande volume aberto.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                  {bulkRequests.map((req) => (
                    <div key={req.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-xl flex justify-between items-center">
                      <div>
                        <strong className="text-xs text-slate-800 dark:text-slate-200 block">{req.type}</strong>
                        <span className="text-[9px] text-slate-500 block truncate max-w-[200px]">{req.address}</span>
                      </div>
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        req.status === 'Pendente' ? 'bg-amber-100/85 text-amber-700' :
                        req.status === 'Agendado' ? 'bg-blue-100/85 text-blue-700' :
                        'bg-green-100/85 text-green-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CITIZEN TRANSACTION HISTORY LIST */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white px-1">Meus descartes validados</h3>
              {moradorHistory.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-8 rounded-3xl text-center shadow-sm">
                  <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">history</span>
                  <p className="text-[11px] text-slate-500">Nenhum histórico de sacos validados ainda.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {moradorHistory.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                      <div className="flex gap-3 items-center">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white ${item.status === 'Aprovado' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                          <span className="material-symbols-outlined text-lg">
                            {item.status === 'Aprovado' ? 'done_all' : 'cancel'}
                          </span>
                        </div>
                        <div>
                          <strong className="text-xs text-slate-800 dark:text-slate-100 block">
                            {item.status === 'Aprovado' ? `+${item.sacosVolume} Sacos Coleta` : 'Descarte Recusado'}
                          </strong>
                          <span className="text-[9px] text-slate-500 block">
                            Status: {item.status === 'Aprovado' ? 'Validado por Agente' : item.reason}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <strong className={`text-xs block ${item.status === 'Aprovado' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {item.status === 'Aprovado' ? `+${item.pontos} Pts` : '0 Pts'}
                        </strong>
                        <span className="text-[9px] text-slate-400">
                          {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Hoje'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. OPERADOR CENTRAL SCANNER VIEW */}
        {activeTab === 'agente' && (
          <div className="space-y-6 animate-fadeIn">
            {/* OFFLINE TOGGLE SWITCH BAR */}
            <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`material-symbols-outlined text-lg ${isOfflineMode ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
                  {isOfflineMode ? 'wifi_off' : 'wifi'}
                </span>
                <div>
                  <strong className="text-xs text-slate-800 dark:text-slate-100 block">Modo Offline (Central)</strong>
                  <span className="text-[9px] text-slate-500">Salva coletas no cache da central quando faltar conexão.</span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOfflineMode(!isOfflineMode)}
                className={`h-7 w-12 rounded-full relative transition-colors duration-300 flex items-center ${isOfflineMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-800'}`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${isOfflineMode ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>

            {/* SYNC WARNING IF OFFLINE TRANSACTIONS ACCUMULATED */}
            {offlineQueue.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl space-y-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-sm animate-bounce">sync_problem</span>
                  Você tem {offlineQueue.length} coletas acumuladas offline!
                </p>
                <button 
                  onClick={handleSyncOfflineQueue}
                  disabled={loading}
                  className="bg-amber-500 w-full text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  {loading ? 'Sincronizando...' : 'Sincronizar com Servidor Agora'}
                </button>
              </div>
            )}

            {/* CAMERA/QR SCAN SIMULATOR AREA */}
            {!simulatedScanMode ? (
              <div className="bg-slate-900 rounded-3xl p-6 text-white text-center flex flex-col justify-center min-h-[340px] shadow-xl relative overflow-hidden border-2 border-emerald-500/20">
                
                {/* Scanner View Simulation lines overlay */}
                <div className="absolute inset-x-8 inset-y-12 border-2 border-dashed border-emerald-500/50 rounded-2xl pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between w-full p-2"><div className="border-t-2 border-l-2 border-emerald-500 h-4 w-4"></div><div className="border-t-2 border-r-2 border-emerald-500 h-4 w-4"></div></div>
                  <div className="flex justify-between w-full p-2"><div className="border-b-2 border-l-2 border-emerald-500 h-4 w-4"></div><div className="border-b-2 border-r-2 border-emerald-500 h-4 w-4"></div></div>
                </div>

                {/* Laser scan line effect */}
                <div className="absolute inset-x-4 h-0.5 bg-emerald-500 shadow-md shadow-emerald-500/50 animate-scan z-10"></div>

                <div className="relative z-20 space-y-6">
                  {/* Flashlight simulator toggle */}
                  <div className="flex justify-end pr-2">
                    <button 
                      onClick={() => setFlashlightOn(!flashlightOn)}
                      className={`h-10 w-10 rounded-full flex items-center justify-center border transition-all ${flashlightOn ? 'bg-yellow-400 border-yellow-300 text-slate-950 shadow-lg shadow-yellow-400/30' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {flashlightOn ? 'flashlight_on' : 'flashlight_off'}
                      </span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <span className="material-symbols-outlined text-emerald-500 text-5xl">qr_code_scanner</span>
                    <h3 className="text-base font-extrabold tracking-wide">Central de Coleta Seletiva</h3>
                    <p className="text-[10px] text-slate-400 max-w-[240px] mx-auto">
                      Valide e registre sacas recebidas escaneando o QR Code do Cidadão na recepção.
                    </p>
                  </div>

                  {/* SANDBOX SCAN ACTION TRIGGERS */}
                  <div className="space-y-3 bg-slate-850 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Presença de Scanner (Simulação):</p>
                    <div className="grid grid-cols-1 gap-2">
                      <select 
                        onChange={(e) => {
                          const citizen = mockCitizens.find(c => c.id === e.target.value);
                          if (citizen) handleSimulateQRScan(citizen);
                        }}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                        defaultValue=""
                      >
                        <option value="" disabled>Selecione um Cidadão para Escanear</option>
                        {mockCitizens.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.neighborhood})</option>
                        ))}
                      </select>

                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="CPF ou Inscrição do Cidadão"
                          value={customCitizenQuery}
                          onChange={(e) => setCustomCitizenQuery(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none w-full focus:border-emerald-500"
                        />
                        <button 
                          onClick={handleManualIDSubmit}
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs font-black px-4 rounded-xl active:scale-95 transition-all text-white"
                        >
                          Manual
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* QUICK CLICKS LAUNCH ACTION PANEL (NO TYPE-PRACTICE DESIGN) */
              <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-5 animate-slideUp">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <div className="flex gap-3 items-center">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
                      <span className="material-symbols-outlined text-lg">person</span>
                    </div>
                    <div>
                      <strong className="text-xs text-slate-800 dark:text-slate-100 block">{simulatedScanMode.name}</strong>
                      <span className="text-[10px] text-slate-500 block">CPF: {simulatedScanMode.cpf}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-emerald-600 font-bold bg-emerald-100/70 border border-emerald-100 px-2 py-0.5 rounded-full uppercase">Imóvel Mapeado</span>
                    <span className="text-[10px] font-mono block text-slate-600 dark:text-slate-300 mt-1">{simulatedScanMode.propertyCode}</span>
                  </div>
                </div>

                {/* BIG CLICK BUTTONS */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-1">Lançamento de Volume por Clique (Sacas)</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setScannedQuantity(1);
                        setRejectReason('');
                      }}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${scannedQuantity === 1 && !rejectReason ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20' : 'bg-slate-55 dark:bg-slate-800 text-slate-700 dark:text-slate-350 border-gray-150 dark:border-slate-800 hover:border-emerald-500'}`}
                    >
                      <span className="material-symbols-outlined text-2xl">eco</span>
                      <strong className="text-xs font-black">1 Saco Verde</strong>
                      <span className="text-[9px] opacity-80">+10 EcoPontos</span>
                    </button>

                    <button 
                      onClick={() => {
                        setScannedQuantity(2);
                        setRejectReason('');
                      }}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${scannedQuantity === 2 && !rejectReason ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20' : 'bg-slate-55 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-150 dark:border-slate-800 hover:border-emerald-500'}`}
                    >
                      <div className="flex gap-0.5">
                        <span className="material-symbols-outlined text-xl">eco</span>
                        <span className="material-symbols-outlined text-xl -ml-2">eco</span>
                      </div>
                      <strong className="text-xs font-black">2 Sacos Verde</strong>
                      <span className="text-[9px] opacity-80">+20 EcoPontos</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setScannedQuantity(3);
                        setRejectReason('');
                      }}
                      className={`col-span-2 p-3.5 rounded-2xl border flex items-center justify-center gap-2 transition-all ${scannedQuantity === 3 && !rejectReason ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-slate-55 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-150 dark:border-slate-800'}`}
                    >
                      <span className="material-symbols-outlined text-lg">check_box</span>
                      <strong className="text-xs font-black">Coleta de 3 Sacos de uma vez! (+30 Pts)</strong>
                    </button>
                  </div>

                  {/* REJECTION OPTIONS IF MATERIAL CANNOT BE ACCEPTED */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Ou recuse o recebimento se houver rejeito:</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setRejectReason('Material Sujo / Contaminação Orgânica');
                          setScannedQuantity(0);
                        }}
                        className={`w-full py-3 rounded-xl border text-xs font-bold transition-all truncate px-2 ${rejectReason === 'Material Sujo / Contaminação Orgânica' ? 'bg-red-500 text-white border-red-500 shadow' : 'bg-slate-50 dark:bg-slate-800 text-red-500 dark:text-red-400 border-red-150 dark:border-red-950'}`}
                      >
                        Material Contaminado
                      </button>
                      <button 
                        onClick={() => {
                          setRejectReason('Resíduo Não Permitido para Campanha');
                          setScannedQuantity(0);
                        }}
                        className={`w-full py-3 rounded-xl border text-xs font-bold transition-all truncate px-2 ${rejectReason === 'Resíduo Não Permitido para Campanha' ? 'bg-red-500 text-white border-red-500 shadow' : 'bg-slate-50 dark:bg-slate-800 text-red-500 dark:text-red-400 border-red-150 dark:border-red-950'}`}
                      >
                        Material Não Permitido
                      </button>
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTONS WITH AUTOMATED STATED ACCURACY COMPUTE BACKGROUND BACKGROUND */}
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setSimulatedScanMode(null)}
                    className="w-1/3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-300 text-xs font-bold py-4 rounded-2xl active:scale-95 transition-all outline-none"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={() => handleRecordColeta(!rejectReason)}
                    className={`w-2/3 text-white text-xs font-black py-4 rounded-2xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 outline-none ${rejectReason ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'}`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {rejectReason ? 'warning' : 'cloud_upload'}
                    </span>
                    {rejectReason ? 'Recusar & Registrar' : 'Confirmar Coleta Seletiva'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* PORT BULKY PICKUP MODAL */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
            {/* Click outer to close */}
            <div className="absolute inset-0" onClick={() => setShowBulkModal(false)}></div>

            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] p-5 relative z-10 shadow-2xl border-t border-slate-200/50 dark:border-slate-800 flex flex-col gap-4 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-850 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Agendar Volume Especial</h3>
                  <p className="text-[10px] text-slate-500 text-left">Recolhimento pela infraestrutura urbana de Riachão.</p>
                </div>
                <button 
                  onClick={() => setShowBulkModal(false)}
                  className="p-1 px-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                >
                  X
                </button>
              </div>

              <form onSubmit={handleRequestBulkPickup} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Tipo de Resíduo Especial</label>
                  <select 
                    value={bulkType} 
                    onChange={(e: any) => setBulkType(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-xs rounded-xl p-3 w-full outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                  >
                    <option value="Podas/Jardinagem">Galha ou Podas de Jardim</option>
                    <option value="Móveis Velhos">Móveis Velhos (Sofá, Guarda-roupas etc)</option>
                    <option value="Eletrônicos/Eletrodomésticos">Linha Branca / Eletrônicos Quebrados</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Endereço Completo de Retirada</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Nome da rua, nº do imóvel, bairro e pontos de referência"
                    value={bulkAddress}
                    onChange={(e) => setBulkAddress(e.target.value)}
                    className="bg-[#fafafa] dark:bg-slate-950 border border-gray-150 dark:border-slate-800 text-xs rounded-xl p-3.5 w-full outline-none focus:bg-white text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Data / Hora de preferência para retirada</label>
                  <input 
                    required 
                    type="datetime-local" 
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="bg-[#fafafa] dark:bg-slate-950 border border-gray-150 dark:border-slate-800 text-xs rounded-xl p-3.5 w-full outline-none focus:bg-white text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Detalhes Adicionais (Quantidade, observação)</label>
                  <textarea 
                    placeholder="Ex: Contém 1 guarda-roupa já desmontado e um colchão rasgado."
                    value={bulkDesc}
                    onChange={(e) => setBulkDesc(e.target.value)}
                    className="bg-[#fafafa] dark:bg-slate-950 border border-gray-150 dark:border-slate-800 text-xs rounded-xl p-3 h-24 w-full outline-none focus:bg-white text-slate-800 dark:text-slate-100 resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={submittingBulk}
                  className="bg-emerald-600 hover:bg-emerald-700 w-full text-white text-xs font-black py-4 rounded-2xl shadow shadow-emerald-500/10 flex items-center justify-center gap-1 active:scale-95 transition-all outline-none"
                >
                  {submittingBulk ? 'Processando envio...' : 'Solicitar Retirada Gratuita'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecyclingScreen;
