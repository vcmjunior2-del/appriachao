
import React, { useState } from 'react';
import { auth, ADMIN_EMAILS } from '../firebaseConfig';

interface AdminLoginScreenProps {
  onBack: () => void;
  onLoginSuccess: () => void;
}

const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onBack, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const emailInput = email.trim();

    try {
      const userCredential = await auth.signInWithEmailAndPassword(emailInput, password);
      const user = userCredential.user;

      // Verificação Estrita de Admin (somente e-mails autorizados)
      if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
          await auth.signOut();
          setError('Acesso Negado: Esta conta não possui privilégios administrativos.');
          setLoading(false);
          return;
      }

      // As regras do Firebase só aceitam admin com e-mail verificado
      if (!user.emailVerified) {
          await user.sendEmailVerification();
          await auth.signOut();
          setError(`E-mail ainda não verificado. Enviamos um link de confirmação para ${user.email}. Abra o link e entre novamente.`);
          setLoading(false);
          return;
      }

      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-login-credentials') {
         setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
         setError('Muitas tentativas. Aguarde um momento por segurança.');
      } else {
         setError('Ocorreu um erro ao processar seu login. Verifique sua conexão.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f6f6f8] dark:bg-[#0f172a] p-6 font-display">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
      
      <div className="w-full max-w-[460px] bg-white dark:bg-[#111a22] rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none p-10 animate-in zoom-in-95 fade-in duration-500 relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>

        <div className="flex flex-col items-center mb-10 relative">
            <div className="h-20 w-20 bg-primary rounded-3xl flex items-center justify-center mb-6 text-white shadow-xl shadow-primary/30">
                <span className="material-symbols-outlined text-4xl">account_balance</span>
            </div>
            <div className="text-center">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">Acesso Restrito</h1>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Painel de Gestão • Riachão</p>
            </div>
        </div>

        {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold flex items-start gap-3 animate-in slide-in-from-top-2">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span className="leading-relaxed">{error}</span>
            </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative">
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Institucional</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <span className="material-symbols-outlined text-[22px]">alternate_email</span>
                    </div>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl pl-12 pr-4 py-4 text-sm font-semibold transition-all outline-none placeholder:text-slate-300 shadow-sm"
                        placeholder="administracao@riachaodojacuipe.ba.gov.br"
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <span className="material-symbols-outlined text-[22px]">lock</span>
                    </div>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl pl-12 pr-4 py-4 text-sm font-semibold transition-all outline-none placeholder:text-slate-300 shadow-sm"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="mt-4 w-full bg-primary hover:bg-blue-700 text-white font-black h-14 rounded-2xl shadow-xl shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
                {loading ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                    <>
                        <span>Entrar no Sistema</span>
                        <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">login</span>
                    </>
                )}
            </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800 flex flex-col items-center gap-4">
            <button 
                onClick={onBack}
                className="text-slate-400 hover:text-primary text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 group"
            >
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                Voltar ao Aplicativo
            </button>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">v2.4.0 Administration</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginScreen;
