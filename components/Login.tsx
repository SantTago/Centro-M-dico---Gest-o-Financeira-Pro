
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (success: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'centromedico' && password === 'miguel2406') {
      onLogin(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-4xl shadow-lg mx-auto mb-4">
            🏥
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Centro Médico</h1>
          <p className="text-slate-500 mt-2">Sistema de Gestão Financeira</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Digite seu login"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Digite sua senha"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-bounce">
              <p className="text-red-700 text-sm font-bold">❌ Usuário ou senha incorretos</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all active:scale-95"
          >
            Acessar Sistema
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">Acesso restrito a usuários autorizados</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
