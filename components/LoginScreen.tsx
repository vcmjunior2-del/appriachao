
import React, { useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebaseConfig';

interface LoginScreenProps {
  onBack: () => void;
  onRegister: () => void;
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onBack, onRegister, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const emailInput = email.trim();

    // --- DEMO BYPASS ---
    if (emailInput === 'demo@riachao.gov.br' && password === '123456') {
        try {
            // Autenticar anonimamente para garantir que currentUser exista no app
            await auth.signInAnonymously();
            onLoginSuccess();
        } catch (e) {
            console.error(e);
            setError('Erro ao iniciar modo demonstração.');
        } finally {
            setLoading(false);
        }
        return;
    }

    try {
      await auth.signInWithEmailAndPassword(emailInput, password);
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-login-credentials') {
         setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
         setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
         setError('Falha ao entrar. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;

        if (user) {
          // Check if user exists in Firestore, if not create (for Admin Panel visibility)
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
              await setDoc(userRef, {
                  id: user.uid,
                  name: user.displayName || "Usuário Google",
                  email: user.email,
                  status: 'Ativo',
                  dateJoined: serverTimestamp(),
                  role: 'citizen',
                  photoURL: user.photoURL
              });
          }
        }

        onLoginSuccess();
    } catch (err: any) {
        console.error("Google Login Error:", err);
        if (err.code === 'auth/unauthorized-domain') {
            setError('Domínio não autorizado (Configurar no Firebase Console).');
        } else if (err.code === 'auth/popup-closed-by-user') {
            setError('Login cancelado pelo usuário.');
        } else if (err.code === 'auth/cancelled-popup-request') {
            // Ignore multiple clicks/popups
        } else if (err.code === 'auth/operation-not-supported-in-this-environment') {
            setError('Ambiente não suportado (HTTP/HTTPS necessário). Use E-mail/Senha.');
        } else {
            setError(`Erro no Login Google: ${err.message || 'Tente novamente.'}`);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setError('');
    setLoading(true);
    try {
        await auth.signInAnonymously();
        onLoginSuccess();
    } catch (err: any) {
        console.error("Anonymous Login Error:", err);
        if (err.code === 'auth/operation-not-allowed') {
             setError('Login anônimo não habilitado no Firebase.');
        } else {
             setError('Erro ao entrar como convidado.');
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark p-6 overflow-y-auto no-scrollbar">
      <header className="flex items-center justify-between mb-6">
        <button 
          onClick={onBack}
          className="size-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined text-gray-800 dark:text-white">arrow_back</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="mb-6 text-center">
            <div className="h-16 w-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
                <span className="material-symbols-outlined text-4xl">lock</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Bem-vindo de volta</h1>
            <p className="text-gray-500 dark:text-gray-400">Escolha uma forma de acesso.</p>
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm text-center font-medium">
                {error}
            </div>
        )}

        <div className="flex flex-col gap-4">
            {/* Google Login */}
            <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white dark:bg-card-dark border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-white font-semibold h-12 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                <span>Entrar com Google</span>
            </button>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-bold">Ou via E-mail</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
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
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Senha</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-white dark:bg-card-dark text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="••••••••"
                    />
                </div>
                
                <div className="flex justify-between items-center">
                    <button type="button" onClick={() => { setEmail('demo@riachao.gov.br'); setPassword('123456'); }} className="text-xs font-medium text-gray-400 hover:text-gray-600 uppercase tracking-wide">
                        Usar Demo
                    </button>
                    <button type="button" className="text-sm font-semibold text-primary hover:text-blue-700 dark:hover:text-blue-400">
                        Esqueceu a senha?
                    </button>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="mt-2 w-full bg-primary hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    ) : (
                        "Entrar com E-mail"
                    )}
                </button>
            </form>
            
            {/* Anonymous Login */}
            <button 
                type="button"
                onClick={handleAnonymousLogin}
                disabled={loading}
                className="mt-2 w-full bg-transparent border-2 border-dashed border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold h-12 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined">person_off</span>
                <span>Continuar como Convidado</span>
            </button>
        </div>

        <div className="mt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
                Não tem uma conta?{' '}
                <button onClick={onRegister} className="text-primary font-bold hover:underline">
                    Cadastre-se
                </button>
            </p>
        </div>
      </main>
    </div>
  );
};

export default LoginScreen;
