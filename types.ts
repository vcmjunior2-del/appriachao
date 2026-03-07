
export enum Screen {
  WELCOME = 'WELCOME',
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  HOME = 'HOME',
  REQUESTS = 'REQUESTS',
  PROFILE = 'PROFILE',
  ALERTS = 'ALERTS',
  SERVICE_DETAILS = 'SERVICE_DETAILS',
  SERVICES = 'SERVICES',
  INFO_SERVICES = 'INFO_SERVICES',
  EMERGENCY = 'EMERGENCY',
  REQUEST_TRACKING = 'REQUEST_TRACKING',
  WEATHER = 'WEATHER',
  DEMOGRAPHICS = 'DEMOGRAPHICS',
  CITY_GUIDE = 'CITY_GUIDE',
  GARBAGE_TRACKER = 'GARBAGE_TRACKER', // Nova Tela
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  colorClass: string;
  textClass: string;
}

export interface RequestHistoryItem {
  date: any;
  status: string;
  title: string;
  description?: string;
  author?: string;
}

export interface RequestItem {
  id: string;
  title: string;
  date: any;
  address: string;
  description?: string;
  status: 'Em Análise' | 'Aberto' | 'Agendado' | 'Concluído' | 'Rejeitado';
  icon: string;
  iconBg: string;
  iconColor: string;
  statusColor: string;
  statusBg: string;
  location?: { lat: number, lng: number };
  photos?: string[];
  history?: RequestHistoryItem[];
  department?: string;
  userId?: string;
  userName?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'update' | 'alert' | 'info' | 'success' | 'event';
  read: boolean;
  readBy?: string[];
  date: any;
  relatedRequestId?: string;
}

export interface GlobalNotification {
  id?: string;
  title: string;
  message: string;
  type: 'info' | 'alert' | 'event';
  date: any;
  active: boolean;
  targetAudience?: 'all' | 'verified';
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  status: 'Ativo' | 'Bloqueado';
  dateJoined: string;
  role?: string;
  cpf?: string;
  isVerified?: boolean;
  address?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  photoURL?: string;
}

export interface Secretariat {
  id: string;
  name: string;
  manager: string;
  email?: string;
  icon: string;
}

// Assuntos de Ocorrência (Agrupadores Principais / Ícones da Home)
export interface OccurrenceSubject {
  id?: string;
  title: string; // Nome do Assunto (ex: Iluminação, Pavimentação)
  secretariatId: string; // Secretaria Responsável
  description: string; // Exemplos de ocorrências (ex: Lâmpada apagada, poste caído)
  icon: string; // URL do ícone ou nome do material symbol
  active: boolean;
  colorTheme?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' | 'gray';
}

export interface ServiceTypeDefinition {
  id?: string;
  title: string;
  secretariatId: string;
  description: string;
  icon: string;
  colorTheme: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  requiresLocation: boolean;
  requiresPhoto: boolean;
  active: boolean;
  subjectId?: string; // Opcional: Link para o Assunto pai
}

export interface InfoServiceDefinition {
  id?: string;
  title: string;
  description: string;
  icon: string;
  colorTheme: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange';
  // Atualizado para suportar TRACKER_BANNER e INTERNAL_ROUTE
  actionType: 'LINK_WEB' | 'INTERNAL_FORM' | 'POLL' | 'STATIC_PAGE' | 'TRACKER_BANNER' | 'INTERNAL_ROUTE';
  actionConfig: string;
  active: boolean;
  
  // Hierarquia
  isFolder?: boolean;
  parentId?: string | null;
}

export interface AppConfig {
    appName: string;
    municipalityName: string;
    logoUrl: string;
    welcomeBackgroundUrl: string;
    supportEmail: string;
    supportPhone: string;
    maintenanceMode: boolean;
}

export interface ImprovementArea {
    id?: string;
    label: string;
    icon: string;
    active: boolean;
}

export interface SentimentLog {
    id?: string;
    userId: string;
    sentiment: number;
    selectedAreas: string[];
    comment?: string;
    date: any;
}

export interface CityPlace {
    id?: string;
    name: string;
    category: 'Úteis' | 'Saúde' | 'Educação' | 'Hospedagem' | 'Gastronomia' | 'Comércio' | 'Lazer' | 'Religião';
    description?: string;
    phone?: string;
    address?: string;
    image?: string; 
    mapLink?: string; 
}

export interface GarbageTruck {
    id: string;
    plate: string; // Placa ou Identificador
    status: 'Em Rota' | 'Parado' | 'Manutenção';
    lat: number;
    lng: number;
    speed: number;
    lastUpdate: any;
    routeDescription?: string;
    deviceType?: string;
}

export interface NewsItem {
    id?: string;
    title: string;
    description: string;
    imageUrl: string;
    videoUrl?: string;
    tag: string;
    colorTheme: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' | 'gray';
    date: any;
    active: boolean;
}
