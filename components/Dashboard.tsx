
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Professional, Patient, Receipt, Expense, Product, DailyConfig } from '../types';

interface DashboardProps {
  onLogout: () => void;
}

const STORAGE_KEY = 'centro_medico_v102_stable';

// Gerador de ID ultra-compatível (sem crypto API)
const generateSafeId = () => {
  return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

const getTodayFormatted = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentDate, setCurrentDate] = useState(getTodayFormatted());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [serviceTypes] = useState([
    { nome: 'Consulta', valor: 'consulta' },
    { nome: 'Procedimento', valor: 'procedimento' },
    { nome: 'Retorno', valor: 'retorno' },
    { nome: 'Cirurgia', valor: 'cirurgia' }
  ]);
  
  const [activeTab, setActiveTab] = useState<'recebimento' | 'despesa'>('recebimento');
  const [activeModal, setActiveModal] = useState<'prof' | 'stock' | null>(null);
  const [temPorcentagem, setTemPorcentagem] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CARREGAMENTO SEGURO ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.professionals)) setProfessionals(data.professionals);
        if (Array.isArray(data.receipts)) setReceipts(data.receipts);
        if (Array.isArray(data.expenses)) setExpenses(data.expenses);
        if (Array.isArray(data.products)) setProducts(data.products);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // --- PERSISTÊNCIA SEGURA ---
  useEffect(() => {
    if (isLoaded) {
      try {
        const data = { professionals, receipts, expenses, products };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.error("Erro ao salvar dados:", err);
      }
    }
  }, [isLoaded, professionals, receipts, expenses, products]);

  // --- CÁLCULOS ---
  const dailyReceipts = useMemo(() => {
    return receipts
      .filter(r => r.date && r.date.split('T')[0] === currentDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [receipts, currentDate]);

  const dailyTotals = useMemo(() => {
    const bruto = dailyReceipts.reduce((s, r) => s + (r.grossValue || 0), 0);
    const liq = dailyReceipts.reduce((s, r) => s + (r.netClinic || 0), 0);
    return { bruto, liq };
  }, [dailyReceipts]);

  // --- HANDLERS ---
  const handleAddReceipt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const profIndex = parseInt(fd.get('professional') as string);
    const prof = professionals[profIndex];
    const gross = parseFloat(fd.get('value') as string);

    if (!prof || isNaN(gross)) return alert("Dados inválidos");

    const profValue = prof.percentage === 100 ? 0 : gross * (prof.percentage / 100);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const fullDate = `${currentDate}T${timeStr}`;

    const newRec: Receipt = {
      id: generateSafeId(),
      grossValue: gross,
      professionalValue: profValue,
      netClinic: gross - profValue,
      professionalId: prof.id,
      professionalName: prof.name,
      serviceType: fd.get('type') as string,
      paymentMethod: fd.get('method') as any,
      date: fullDate
    };

    setReceipts(prev => [...prev, newRec]);
    e.currentTarget.reset();
  };

  const exportData = () => {
    const data = { professionals, receipts, expenses, products };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_clinica_${currentDate}.json`;
    link.click();
  };

  if (!isLoaded) return <div className="flex h-screen items-center justify-center font-bold text-blue-600 bg-white">Carregando Banco de Dados...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      {/* Header Fixo */}
      <header className="bg-white border-b sticky top-0 z-40 px-4 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏥</span>
            <div>
              <h1 className="text-xl font-bold text-blue-700 leading-none">Centro Médico</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Camocim - Financeiro</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportData} className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold border border-blue-100">Backup</button>
            <button onClick={onLogout} className="text-xs bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Seletor de Data */}
        <section className="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between">
          <button onClick={() => {
            const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
            setCurrentDate(d.toISOString().split('T')[0]);
          }} className="p-2 bg-slate-50 rounded-full">⬅️</button>
          
          <div className="text-center">
            <p className="text-[9px] font-black uppercase text-slate-400">Data de Consulta</p>
            <input 
              type="date" 
              value={currentDate} 
              onChange={(e) => setCurrentDate(e.target.value)}
              className="font-bold text-lg text-slate-700 border-none bg-transparent focus:ring-0 cursor-pointer"
            />
          </div>

          <button onClick={() => {
            const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
            setCurrentDate(d.toISOString().split('T')[0]);
          }} className="p-2 bg-slate-50 rounded-full">➡️</button>
        </section>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-md">
            <p className="text-[10px] font-bold uppercase opacity-80">Bruto Hoje</p>
            <p className="text-xl font-black">R$ {dailyTotals.bruto.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-md">
            <p className="text-[10px] font-bold uppercase opacity-80">Clínica Hoje</p>
            <p className="text-xl font-black">R$ {dailyTotals.liq.toFixed(2)}</p>
          </div>
        </div>

        {/* Lançamento */}
        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
          <div className="flex border-b">
            <button onClick={() => setActiveTab('recebimento')} className={`flex-1 py-4 font-bold text-sm ${activeTab === 'recebimento' ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500' : 'text-slate-400'}`}>RECEBIMENTO</button>
            <button onClick={() => setActiveTab('despesa')} className={`flex-1 py-4 font-bold text-sm ${activeTab === 'despesa' ? 'bg-red-50 text-red-700 border-b-2 border-red-500' : 'text-slate-400'}`}>DESPESA</button>
          </div>
          
          <div className="p-6">
            {activeTab === 'recebimento' ? (
              <form onSubmit={handleAddReceipt} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input name="value" type="number" step="0.01" placeholder="Valor R$" className="p-3 border rounded-xl font-bold bg-slate-50" required />
                <select name="professional" className="p-3 border rounded-xl font-bold bg-slate-50" required>
                  <option value="">Médico/Profissional</option>
                  {professionals.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
                </select>
                <select name="type" className="p-3 border rounded-xl font-bold bg-slate-50">
                  {serviceTypes.map(t => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
                </select>
                <select name="method" className="p-3 border rounded-xl font-bold bg-slate-50">
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="unimed">Unimed</option>
                </select>
                <button type="submit" className="md:col-span-4 bg-emerald-600 text-white py-3 rounded-xl font-black shadow-lg hover:bg-emerald-700">SALVAR RECEBIMENTO</button>
              </form>
            ) : (
              <p className="text-center text-slate-400 italic py-4">Módulo de despesas simplificado.</p>
            )}
          </div>
        </div>

        {/* Histórico Corrigido */}
        <section className="bg-white rounded-3xl shadow-sm border overflow-hidden">
          <div className="p-5 border-b bg-slate-50/50">
            <h3 className="font-black text-slate-700 uppercase tracking-tighter">Histórico de Recebimentos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                  <th className="px-6 py-4">DATA</th>
                  <th className="px-6 py-4">HORA</th>
                  <th className="px-6 py-4">PROFISSIONAL</th>
                  <th className="px-6 py-4">VALOR BRUTO</th>
                  <th className="px-6 py-4">ATENDIMENTO</th>
                  <th className="px-6 py-4">PAGAMENTO</th>
                  <th className="px-6 py-4 text-emerald-600">LÍQ. CLÍNICA</th>
                  <th className="px-6 py-4">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {dailyReceipts.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-slate-300 italic">Nenhum registro para hoje.</td></tr>
                ) : (
                  dailyReceipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium">{new Date(rec.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4 text-blue-600 font-bold">{rec.date.split('T')[1].substring(0, 5)}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{rec.professionalName}</td>
                      <td className="px-6 py-4 font-black">R$ {rec.grossValue.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-black uppercase">
                          {serviceTypes.find(s => s.valor === rec.serviceType)?.nome || rec.serviceType}
                        </span>
                      </td>
                      <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-500">{rec.paymentMethod}</td>
                      <td className="px-6 py-4 font-black text-emerald-600">R$ {rec.netClinic.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => { if(confirm("Excluir?")) setReceipts(p => p.filter(r => r.id !== rec.id)) }} className="text-slate-300 hover:text-red-500">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Botões de Gestão */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => setActiveModal('prof')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:scale-105 transition-all text-sm">+ Profissional</button>
          <button onClick={() => setActiveModal('stock')} className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:scale-105 transition-all text-sm">Estoque</button>
        </div>
      </main>

      {/* Modal Novo Profissional */}
      {activeModal === 'prof' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-indigo-600 uppercase">Novo Profissional</h2>
              <button onClick={() => {setActiveModal(null); setTemPorcentagem(null)}} className="text-2xl text-slate-300">&times;</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const perc = temPorcentagem ? parseInt(fd.get('perc') as string) : 100;
              setProfessionals(p => [...p, {
                id: generateSafeId(),
                name: fd.get('name') as string,
                specialty: fd.get('spec') as string,
                phone: '',
                percentage: perc,
                createdAt: new Date().toISOString()
              }]);
              setActiveModal(null);
              setTemPorcentagem(null);
            }} className="space-y-4">
              <input name="name" placeholder="Nome do Médico" className="w-full p-4 border rounded-xl font-bold" required />
              <input name="spec" placeholder="Especialidade" className="w-full p-4 border rounded-xl font-bold" />
              
              <div className="flex gap-2">
                <button type="button" onClick={() => setTemPorcentagem(true)} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase ${temPorcentagem === true ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>Com Comissão</button>
                <button type="button" onClick={() => setTemPorcentagem(false)} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase ${temPorcentagem === false ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'}`}>Sem Comissão</button>
              </div>
              
              {temPorcentagem && <input name="perc" type="number" placeholder="Porcentagem %" className="w-full p-4 border rounded-xl font-bold text-center" required />}
              
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg">CADASTRAR</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
