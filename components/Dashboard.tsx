
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Professional, Patient, Receipt, Expense, Product, DailyConfig } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface DashboardProps {
  onLogout: () => void;
}

const STORAGE_KEY = 'centroMedicoCamocim_v101';

// Função utilitária para gerar IDs compatível com navegadores antigos
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Formatação de data segura YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  // --- Estados Principais ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentDate, setCurrentDate] = useState(getTodayString());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dailyConfigs, setDailyConfigs] = useState<DailyConfig[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{nome: string, valor: string}[]>([
    { nome: 'Consulta', valor: 'consulta' },
    { nome: 'Procedimento', valor: 'procedimento' },
    { nome: 'Retorno', valor: 'retorno' },
    { nome: 'Cirurgia', valor: 'cirurgia' }
  ]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'recebimento' | 'despesa'>('recebimento');
  const [activeModal, setActiveModal] = useState<'prof' | 'patient' | 'patientList' | 'stock' | 'profDetail' | 'cash' | 'manageServices' | 'editProf' | null>(null);
  const [selectedProfIndex, setSelectedProfIndex] = useState<number | null>(null);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filtros/Buscas
  const [stockSearch, setStockSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'todos' | 'baixo' | 'zerado'>('todos');
  const [temPorcentagem, setTemPorcentagem] = useState<boolean | null>(null);

  // --- Carregamento Inicial ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.professionals) setProfessionals(data.professionals);
        if (data.patients) setPatients(data.patients);
        if (data.receipts) setReceipts(data.receipts);
        if (data.expenses) setExpenses(data.expenses);
        if (data.products) setProducts(data.products);
        if (data.dailyConfigs) setDailyConfigs(data.dailyConfigs);
        if (data.serviceTypes) setServiceTypes(data.serviceTypes);
      } catch (e) { 
        console.error("Falha ao restaurar banco local:", e); 
      }
    }
    setIsLoaded(true);
  }, []);

  // --- Persistência Automática ---
  useEffect(() => {
    if (isLoaded) {
      const data = { professionals, patients, receipts, expenses, products, dailyConfigs, serviceTypes };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [isLoaded, professionals, patients, receipts, expenses, products, dailyConfigs, serviceTypes]);

  // --- Funções de Exportação e Importação ---
  const exportData = () => {
    const data = { professionals, patients, receipts, expenses, products, dailyConfigs, serviceTypes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_centro_medico_${currentDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (confirm("Isso irá substituir todos os dados atuais. Deseja continuar?")) {
          setProfessionals(data.professionals || []);
          setPatients(data.patients || []);
          setReceipts(data.receipts || []);
          setExpenses(data.expenses || []);
          setProducts(data.products || []);
          setDailyConfigs(data.dailyConfigs || []);
          if (data.serviceTypes) setServiceTypes(data.serviceTypes);
          alert("Dados importados com sucesso!");
        }
      } catch (err) {
        alert("Erro ao importar: Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  };

  const clearBank = () => {
    if (confirm("ATENÇÃO: Isso apagará TODOS os dados cadastrados. Tem certeza?")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };

  // --- Cálculos ---
  const dailyReceipts = useMemo(() => 
    receipts.filter(r => r.date && r.date.split('T')[0] === currentDate),
    [receipts, currentDate]
  ).sort((a, b) => b.date.localeCompare(a.date));

  const dailyExpenses = useMemo(() => 
    expenses.filter(e => e.date && e.date.split('T')[0] === currentDate),
    [expenses, currentDate]
  );

  const dailyTotals = useMemo(() => {
    const rec = dailyReceipts.reduce((s, r) => s + (r.grossValue || 0), 0);
    const exp = dailyExpenses.reduce((s, e) => s + (e.value || 0), 0);
    const liq = dailyReceipts.reduce((s, r) => s + (r.netClinic || 0), 0);
    return { rec, exp, liq };
  }, [dailyReceipts, dailyExpenses]);

  const monthlyReceipts = useMemo(() => {
    const targetDate = new Date(currentDate + 'T12:00:00');
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    return receipts.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
  }, [receipts, currentDate]);

  const totals = useMemo(() => {
    const brutoMes = monthlyReceipts.reduce((sum, r) => sum + (r.grossValue || 0), 0);
    const liquidoMes = monthlyReceipts.reduce((sum, r) => sum + (r.netClinic || 0), 0);
    const pixMes = monthlyReceipts.filter(r => r.paymentMethod === 'pix').reduce((sum, r) => sum + (r.grossValue || 0), 0);
    const moneyMes = monthlyReceipts.filter(r => r.paymentMethod === 'dinheiro').reduce((sum, r) => sum + (r.grossValue || 0), 0);
    const cardMes = monthlyReceipts.filter(r => r.paymentMethod === 'cartao').reduce((sum, r) => sum + (r.grossValue || 0), 0);
    const unimedMes = monthlyReceipts.filter(r => r.paymentMethod === 'unimed').reduce((sum, r) => sum + (r.grossValue || 0), 0);
    return { brutoMes, liquidoMes, pixMes, moneyMes, cardMes, unimedMes };
  }, [monthlyReceipts]);

  // --- Handlers de Ações ---
  const addReceipt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const profIndex = parseInt(formData.get('professional') as string);
    const prof = professionals[profIndex];
    if (!prof) return alert("Selecione um profissional");

    const gross = parseFloat(formData.get('value') as string);
    if (isNaN(gross)) return alert("Valor inválido");

    const profValue = prof.percentage === 100 ? 0 : gross * (prof.percentage / 100);
    const net = gross - profValue;
    
    // Formato robusto de hora local
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const localFullDate = `${currentDate}T${hours}:${minutes}:${seconds}`;

    const newRec: Receipt = {
      id: generateId(),
      grossValue: gross,
      professionalValue: profValue,
      netClinic: net,
      professionalId: prof.id,
      professionalName: prof.name,
      serviceType: formData.get('type') as string,
      paymentMethod: formData.get('method') as any,
      date: localFullDate
    };

    setReceipts(prev => [...prev, newRec]);
    e.currentTarget.reset();
  };

  const handleEditProfSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProf) return;
    const fd = new FormData(e.currentTarget);
    setProfessionals(prev => prev.map(p => p.id === editingProf.id ? {
      ...p,
      name: fd.get('name') as string,
      specialty: fd.get('spec') as string,
      phone: fd.get('phone') as string,
      percentage: parseInt(fd.get('perc') as string) || 100
    } : p));
    setActiveModal(null);
    setEditingProf(null);
  };

  if (!isLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-blue-600">Iniciando Sistema...</div>;

  return (
    <div className="dashboard-wrapper min-h-screen bg-[#f4f4f9] p-4 md:p-8">
      <div className="dashboard-container max-w-[1400px] mx-auto">
        
        {/* Header */}
        <header className="header flex flex-col md:flex-row items-center gap-5 mb-8">
          <div className="logo-placeholder w-16 h-16 bg-gradient-to-br from-[#0056b3] to-[#0084d4] rounded-xl flex items-center justify-center text-3xl shadow-lg">🏥</div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="main-title text-2xl md:text-3xl font-bold text-[#0056b3] m-0">Centro Médico - Camocim</h1>
            <div className="text-sm opacity-90 mt-1 font-medium tracking-tight">Gestão Financeira e Comissões Profissionais</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <input type="file" ref={fileInputRef} onChange={importData} className="hidden" accept=".json" />
            <button onClick={exportData} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-600">📥 Backup</button>
            <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold shadow border border-slate-200">📤 Restaurar</button>
            <button onClick={onLogout} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold shadow">Sair</button>
          </div>
        </header>

        {/* Navegação por Dia */}
        <section className="bg-white p-4 md:p-6 rounded-2xl shadow-sm mb-8 border border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => {
                const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
                setCurrentDate(d.toISOString().split('T')[0]);
              }} className="bg-slate-100 p-3 rounded-full hover:bg-slate-200 transition-colors">⬅️</button>
              <div className="text-center px-6">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Data Consultada</div>
                <div className="text-lg md:text-xl font-black text-slate-800">
                  {new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
              <button onClick={() => {
                const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
                setCurrentDate(d.toISOString().split('T')[0]);
              }} className="bg-slate-100 p-3 rounded-full hover:bg-slate-200 transition-colors">➡️</button>
            </div>
            <button onClick={() => setCurrentDate(getTodayString())} className="px-6 py-2 bg-[#0056b3] text-white font-bold rounded-lg shadow-md">📌 Ir para Hoje</button>
          </div>
        </section>

        {/* Totais do Dia/Mês */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500">
            <div className="text-slate-400 font-bold text-xs uppercase mb-1">Bruto Hoje</div>
            <div className="text-2xl font-black text-slate-800">R$ {dailyTotals.rec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-emerald-500">
            <div className="text-slate-400 font-bold text-xs uppercase mb-1">Líquido Clínica Hoje</div>
            <div className="text-2xl font-black text-emerald-600">R$ {dailyTotals.liq.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-indigo-500">
            <div className="text-slate-400 font-bold text-xs uppercase mb-1">Bruto do Mês</div>
            <div className="text-2xl font-black text-indigo-600">R$ {totals.brutoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
        </section>

        {/* Lançamentos Rápidos */}
        <div className="form-section bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-slate-100 mb-8">
          <div className="flex gap-4 mb-8 border-b-2 border-slate-50 pb-6">
            <button onClick={() => setActiveTab('recebimento')} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'recebimento' ? 'bg-[#28a745] text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>📥 Novo Recebimento</button>
            <button onClick={() => setActiveTab('despesa')} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'despesa' ? 'bg-[#dc3545] text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>💸 Nova Despesa</button>
          </div>

          {activeTab === 'recebimento' ? (
            <form onSubmit={addReceipt}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Valor Bruto</label>
                  <input name="value" type="number" step="0.01" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 focus:border-emerald-500 outline-none font-bold text-lg" required placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Profissional</label>
                  <select name="professional" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none font-bold" required>
                    <option value="">Selecione...</option>
                    {professionals.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Atendimento/Serviço</label>
                  <select name="type" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 focus:border-blue-500 outline-none font-bold" required>
                    {serviceTypes.map((t, i) => <option key={i} value={t.valor}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Meio de Pagamento</label>
                  <select name="method" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 focus:border-amber-500 outline-none font-bold" required>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="unimed">Unimed</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl shadow-xl hover:bg-emerald-700 transition-all uppercase tracking-widest">Salvar no Histórico</button>
            </form>
          ) : (
             <form onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               const val = parseFloat(fd.get('value') as string);
               if (isNaN(val)) return alert("Valor inválido");
               
               const now = new Date();
               const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
               
               setExpenses(prev => [...prev, {
                 id: generateId(),
                 value: val,
                 category: fd.get('category') as string,
                 description: fd.get('desc') as string,
                 paymentMethod: fd.get('method') as string,
                 date: `${currentDate}T${localTime}`
               }]);
               e.currentTarget.reset();
             }}>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                 <input name="value" type="number" step="0.01" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold" placeholder="Valor (0,00)" required />
                 <input name="category" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold" placeholder="Categoria" required />
                 <input name="desc" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold" placeholder="Descrição" required />
                 <select name="method" className="w-full p-4 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold" required>
                   <option value="pix">PIX</option>
                   <option value="cartao">Cartão</option>
                   <option value="dinheiro">Dinheiro</option>
                 </select>
               </div>
               <button type="submit" className="w-full py-4 bg-rose-600 text-white font-black rounded-xl shadow-xl uppercase tracking-widest">Registrar Despesa</button>
             </form>
          )}
        </div>

        {/* Histórico Geral */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-12">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Histórico de Recebimentos</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Dia {new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Profissional</th>
                  <th className="px-6 py-4">Valor Bruto</th>
                  <th className="px-6 py-4">Atendimento</th>
                  <th className="px-6 py-4">Pagamento</th>
                  <th className="px-6 py-4 text-red-500">Comissão</th>
                  <th className="px-6 py-4 text-emerald-600">Líq. Clínica</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyReceipts.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-16 text-center text-slate-300 font-black uppercase italic text-sm">Nenhum recebimento registrado para este dia.</td></tr>
                ) : (
                  dailyReceipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-all text-xs md:text-sm">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{new Date(rec.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</div>
                        <div className="text-[10px] text-blue-500 font-black">{rec.date.split('T')[1]?.substring(0, 5)}</div>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-700">{rec.professionalName}</td>
                      <td className="px-6 py-4 font-mono font-black">R$ {rec.grossValue.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
                          {serviceTypes.find(t => t.valor === rec.serviceType)?.nome || rec.serviceType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[9px] font-black uppercase border border-slate-200">{rec.paymentMethod}</span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-red-500">R$ {rec.professionalValue.toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-600">R$ {rec.netClinic.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => { if(confirm("Excluir este lançamento?")) setReceipts(prev => prev.filter(r => r.id !== rec.id)); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Botões de Ação Final */}
        <section className="flex flex-wrap gap-3 justify-center mb-20">
          <button onClick={() => setActiveModal('prof')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg text-sm hover:scale-105 transition-all">+ Profissional</button>
          <button onClick={() => setActiveModal('patient')} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg text-sm hover:scale-105 transition-all">+ Paciente</button>
          <button onClick={() => setActiveModal('stock')} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg text-sm hover:scale-105 transition-all">📦 Estoque</button>
          <button onClick={clearBank} className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg text-sm hover:scale-105 transition-all">🗑️ Limpar Tudo</button>
        </section>
      </div>

      {/* --- MODAIS (Versão Compacta) --- */}

      {activeModal === 'prof' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-black text-indigo-600 uppercase tracking-tight">⚕️ Novo Profissional</h2><button onClick={() => { setActiveModal(null); setTemPorcentagem(null); }} className="text-slate-400 text-3xl font-light">&times;</button></div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if(temPorcentagem === null) return alert("Defina o regime de comissão.");
              const finalPerc = temPorcentagem ? parseInt(fd.get('perc') as string) : 100;
              setProfessionals(prev => [...prev, { id: generateId(), name: fd.get('name') as string, specialty: fd.get('spec') as string, phone: fd.get('phone') as string, percentage: finalPerc, createdAt: new Date().toISOString() }]);
              setActiveModal(null); setTemPorcentagem(null);
            }} className="p-8 space-y-4">
              <input name="name" className="w-full p-4 border-2 border-slate-100 rounded-xl font-bold" placeholder="Nome Completo" required />
              <input name="spec" className="w-full p-4 border-2 border-slate-100 rounded-xl font-bold" placeholder="Especialidade" />
              <div className="flex gap-2"><button type="button" onClick={() => setTemPorcentagem(true)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${temPorcentagem===true ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>✅ Com Comissão</button><button type="button" onClick={() => setTemPorcentagem(false)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${temPorcentagem===false ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'}`}>❌ Sem Comissão</button></div>
              {temPorcentagem === true && <input name="perc" type="number" className="w-full p-4 border-2 border-slate-100 rounded-xl font-black text-center text-xl" placeholder="Qual o %?" required />}
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg uppercase tracking-widest mt-4">Confirmar</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Estoque */}
      {activeModal === 'stock' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-black text-amber-700 uppercase">📦 Controle de Estoque</h2><button onClick={() => setActiveModal(null)} className="text-slate-400 text-3xl font-light">&times;</button></div>
            <div className="p-6">
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setProducts(prev => [...prev, { id: generateId(), name: fd.get('name') as string, quantity: parseInt(fd.get('qty') as string), minQuantity: parseInt(fd.get('min') as string) }]);
                e.currentTarget.reset();
              }} className="flex flex-col md:flex-row gap-2 mb-6 p-4 bg-slate-50 rounded-2xl">
                <input name="name" className="flex-1 p-3 border-2 border-slate-100 rounded-xl font-bold" placeholder="Produto" required />
                <input name="qty" type="number" className="w-20 p-3 border-2 border-slate-100 rounded-xl text-center font-black" placeholder="Qtd" required />
                <button type="submit" className="bg-amber-600 text-white px-6 py-3 rounded-xl font-black">Add</button>
              </form>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {products.length === 0 && <p className="text-center text-slate-400 py-10 italic">Nenhum item em estoque.</p>}
                {products.map(p => (
                  <div key={p.id} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                    <div className="flex-1 font-black text-slate-700 uppercase text-xs">{p.name}</div>
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-black text-blue-600">{p.quantity}</div>
                      <div className="flex gap-1">
                        <button onClick={() => setProducts(prev => prev.map(x => x.id === p.id && x.quantity > 0 ? {...x, quantity: x.quantity - 1} : x))} className="w-8 h-8 bg-slate-100 rounded-lg text-red-500 font-bold">-</button>
                        <button onClick={() => setProducts(prev => prev.map(x => x.id === p.id ? {...x, quantity: x.quantity + 1} : x))} className="w-8 h-8 bg-slate-100 rounded-lg text-emerald-500 font-bold">+</button>
                        <button onClick={() => { if(confirm("Remover item?")) setProducts(prev => prev.filter(x => x.id !== p.id)); }} className="ml-2 text-slate-300">🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
