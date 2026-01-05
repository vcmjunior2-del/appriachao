
import React, { useState, useRef } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebaseConfig';

interface RegisterScreenProps {
  onBack: () => void;
  onLogin: () => void;
  onRegisterSuccess: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onBack, onLogin, onRegisterSuccess }) => {
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  
  // Address State
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Riachão do Jacuípe');

  // Photo State
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Máscara simples para CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    
    setCpf(value);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !cpf || !password) {
        return setError('Preencha os campos obrigatórios (Nome, CPF, Email, Senha).');
    }

    if (password !== confirmPassword) {
        return setError('As senhas não coincidem.');
    }
    
    if (password.length < 6) {
        return setError('A senha deve ter pelo menos 6 caracteres.');
    }

    setError('');
    setLoading(true);

    try {
      // 1. Create Auth User
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      let photoURL = "";

      // 2. Upload Photo if exists
      if (photoFile && user) {
        try {
            const storageRef = ref(storage, `profile_photos/${user.uid}`);
            await uploadBytes(storageRef, photoFile);
            photoURL = await getDownloadURL(storageRef);
        } catch (uploadError) {
            console.error("Erro ao enviar foto:", uploadError);
            // Continue registration even if photo fails, but log it
        }
      }

      // 3. Update Auth Profile
      if (user) {
        await user.updateProfile({
            displayName: name,
            photoURL: photoURL || null
        });

        // Construct formatted address
        const fullAddress = street 
            ? `${street}, ${number || 'S/N'} - ${neighborhood}, ${city}` 
            : '';

        // 4. Create User Document in Firestore
        await setDoc(doc(db, "users", user.uid), {
            id: user.uid,
            name: name,
            email: email,
            cpf: cpf,
            street: street,
            number: number,
            neighborhood: neighborhood,
            city: city,
            address: fullAddress,
            photoURL: photoURL,
            status: 'Ativo',
            isVerified: false, // Default verification status
            dateJoined: serverTimestamp(),
            role: 'citizen'
        });
      }

      onRegisterSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
         setError('Este e-mail já está cadastrado.');
      } else if (err.code === 'auth/invalid-email') {
         setError('Formato de e-mail inválido.');
      } else {
         setError('Falha ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark p-6 overflow-y-auto no-scrollbar">
      <header className="flex items-center justify-between mb-4">
        <button 
          onClick={onBack}
          className="size-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined text-gray-800 dark:text-white">arrow_back</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pb-8">
        <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Crie sua conta</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Insira seus dados para acessar os serviços.</p>
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm text-center">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Foto de Perfil */}
            <div className="flex justify-center mb-2">
                <div 
                    className="relative w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-800 border-4 border-white dark:border-gray-700 shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                        </div>
                    )}
                    <div className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 border-2 border-white dark:border-gray-900">
                        <span className="material-symbols-outlined text-sm font-bold block">edit</span>
                    </div>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    accept="image/*"
                    className="hidden"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Nome Completo</label>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="João Silva"
                />
            </div>
            
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 ml-1">CPF</label>
                <input 
                    type="text" 
                    value={cpf}
                    onChange={handleCpfChange}
                    required
                    maxLength={14}
                    className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="000.000.000-00"
                />
            </div>

            {/* Endereço - Campos Separados */}
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold text-primary uppercase tracking-wide">Endereço Residencial</p>
                
                <div className="flex gap-3">
                    <div className="flex-grow-[3]">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 ml-1">Rua / Logradouro</label>
                        <input 
                            type="text" 
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                            placeholder="Nome da Rua"
                        />
                    </div>
                    <div className="flex-grow-[1] min-w-[80px]">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 ml-1">Nº</label>
                        <input 
                            type="text" 
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                            placeholder="123"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 ml-1">Bairro</label>
                        <input 
                            type="text" 
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                            placeholder="Centro"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 ml-1">Cidade</label>
                        <input 
                            type="text" 
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                            placeholder="Cidade"
                        />
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 ml-1">E-mail</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="seu@email.com"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Senha</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="Mínimo 6"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Confirmar</label>
                    <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="Repetir"
                    />
                </div>
            </div>
            
            <button 
                type="submit" 
                disabled={loading}
                className="mt-4 w-full bg-primary hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                    "Criar Conta"
                )}
            </button>
        </form>

        <div className="mt-8 text-center pb-6">
            <p className="text-gray-600 dark:text-gray-400">
                Já tem uma conta?{' '}
                <button onClick={onLogin} className="text-primary font-bold hover:underline">
                    Fazer Login
                </button>
            </p>
        </div>
      </main>
    </div>
  );
};

export default RegisterScreen;
