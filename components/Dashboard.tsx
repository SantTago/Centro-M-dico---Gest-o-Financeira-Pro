
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Professional, Patient, Receipt, Expense, Product, DailyConfig } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface DashboardProps {
  onLogout: () => void;
}

const STORAGE_KEY = 'centroMedicoCamocim_v100';

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  // --- Estados Principais ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString('en-CA'));
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
    receipts.filter(r => r.date.startsWith(currentDate)),
    [receipts, currentDate]
  ).sort((a, b) => b.date.localeCompare(a.date));

  const dailyExpenses = useMemo(() => 
    expenses.filter(e => e.date.startsWith(currentDate)),
    [expenses, currentDate]
  );

  const dailyTotals = useMemo(() => {
    const rec = dailyReceipts.reduce((s, r) => s + r.grossValue, 0);
    const exp = dailyExpenses.reduce((s, e) => s + e.value, 0);
    const liq = dailyReceipts.reduce((s, r) => s + r.netClinic, 0);
    return { rec, exp, liq };
  }, [dailyReceipts, dailyExpenses]);

  const dailyAccountTotals = useMemo(() => {
    const acc = { pix: 0, dinheiro: 0, cartao: 0, unimed: 0 };
    dailyReceipts.forEach(r => {
      const method = r.paymentMethod as keyof typeof acc;
      if (acc.hasOwnProperty(method)) acc[method] += r.grossValue;
    });
    return acc;
  }, [dailyReceipts]);

  const monthlyReceipts = useMemo(() => {
    const target = new Date(currentDate + 'T12:00:00');
    return receipts.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
    });
  }, [receipts, currentDate]);

  const totals = useMemo(() => {
    const brutoMes = monthlyReceipts.reduce((sum, r) => sum + r.grossValue, 0);
    const liquidoMes = monthlyReceipts.reduce((sum, r) => sum + r.netClinic, 0);
    const pixMes = monthlyReceipts.filter(r => r.paymentMethod === 'pix').reduce((sum, r) => sum + r.grossValue, 0);
    const moneyMes = monthlyReceipts.filter(r => r.paymentMethod === 'dinheiro').reduce((sum, r) => sum + r.grossValue, 0);
    const cardMes = monthlyReceipts.filter(r => r.paymentMethod === 'cartao').reduce((sum, r) => sum + r.grossValue, 0);
    const unimedMes = monthlyReceipts.filter(r => r.paymentMethod === 'unimed').reduce((sum, r) => sum + r.grossValue, 0);
    return { brutoMes, liquidoMes, pixMes, moneyMes, cardMes, unimedMes };
  }, [monthlyReceipts]);

  const barData = useMemo(() => {
    const stats: Record<string, number> = {};
    monthlyReceipts.forEach(r => {
      const label = serviceTypes.find(t => t.valor === r.serviceType)?.nome || r.serviceType;
      stats[label] = (stats[label] || 0) + r.grossValue;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [monthlyReceipts, serviceTypes]);

  const initialCash = useMemo(() => {
    return dailyConfigs.find(c => c.date === currentDate)?.initialCash || 0;
  }, [dailyConfigs, currentDate]);

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
    const localFullDate = `${currentDate}T${new Date().toTimeString().split(' ')[0]}`;

    const newRec: Receipt = {
      id: crypto.randomUUID(),
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

  const pieData = [
    { name: 'Cartão', value: totals.cardMes, color: '#ff6384' },
    { name: 'PIX', value: totals.pixMes, color: '#4bc0c0' },
    { name: 'Dinheiro', value: totals.moneyMes, color: '#ffcd56' },
    { name: 'Unimed', value: totals.unimedMes, color: '#9966ff' },
  ].filter(d => d.value > 0);

  const selectedProfDetails = useMemo(() => {
    if (selectedProfIndex === null) return null;
    const prof = professionals[selectedProfIndex];
    if (!prof) return null;
    const profRecs = dailyReceipts.filter(r => r.professionalId === prof.id);
    const paymentTotals = { pix: 0, dinheiro: 0, cartao: 0, unimed: 0 };
    profRecs.forEach(r => { if(paymentTotals.hasOwnProperty(r.paymentMethod)) (paymentTotals as any)[r.paymentMethod] += r.grossValue; });
    const bVal = profRecs.reduce((s, r) => s + r.grossValue, 0);
    const pVal = profRecs.reduce((s, r) => s + r.professionalValue, 0);
    const cVal = profRecs.reduce((s, r) => s + r.netClinic, 0);
    return { prof, profRecs, paymentTotals, bVal, pVal, cVal };
  }, [selectedProfIndex, dailyReceipts, professionals]);

  if (!isLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-blue-600">Carregando Sistema...</div>;

  return (
    <div className="dashboard-wrapper min-h-screen bg-[#f4f4f9] p-8">
      <div className="dashboard-container max-w-[1400px] mx-auto">
        
        {/* Header */}
        <header className="header flex items-center gap-5 mb-8 flex-wrap">
          <div className="logo-placeholder w-16 h-16 bg-gradient-to-br from-[#0056b3] to-[#0084d4] rounded-xl flex items-center justify-center text-3xl shadow-lg">🏥</div>
          <div className="flex-1">
            <h1 className="main-title text-3xl font-bold text-[#0056b3] m-0">Controle Financeiro Centro Médico</h1>
            <div className="text-sm opacity-90 mt-1 font-medium tracking-tight">Gestão de Recebimentos, Despesas e Comissões</div>
          </div>
          <div className="flex gap-3">
            <input type="file" ref={fileInputRef} onChange={importData} className="hidden" accept=".json" />
            <button onClick={exportData} className="header-btn bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-blue-600 transition-colors">📥 Exportar</button>
            <button onClick={() => fileInputRef.current?.click()} className="header-btn bg-white text-slate-700 px-6 py-3 rounded-lg font-semibold shadow border border-slate-200 hover:bg-slate-50 transition-colors">📤 Importar</button>
            <button onClick={clearBank} className="header-btn bg-red-500 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-red-600 transition-colors">🗑️ Limpar Banco</button>
            <button onClick={onLogout} className="bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-semibold shadow hover:bg-slate-300 transition-colors">Sair</button>
          </div>
        </header>

        {/* Navegação por Dia */}
        <section className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-slate-100">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-bold text-slate-800 m-0">📅 Calendário de Gestão</h2>
            <button onClick={() => setCurrentDate(new Date().toLocaleDateString('en-CA'))} className="px-5 py-2.5 bg-[#0056b3] text-white font-bold rounded-lg shadow-md hover:bg-[#004494]">📌 Hoje</button>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={() => {
              const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
              setCurrentDate(d.toLocaleDateString('en-CA'));
            }} className="bg-[#6c757d] text-white px-5 py-3 rounded-lg font-bold">← Anterior</button>
            <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-10 py-4 rounded-xl text-center min-w-[350px] shadow-lg">
              <div className="text-[10px] opacity-80 mb-1 uppercase tracking-[0.2em] font-black">Data Selecionada</div>
              <div className="text-2xl font-bold">{new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <button onClick={() => {
              const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
              setCurrentDate(d.toLocaleDateString('en-CA'));
            }} className="bg-[#6c757d] text-white px-5 py-3 rounded-lg font-bold">Próximo →</button>
          </div>
        </section>

        {/* Totais do Mês */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-[#f0f7ff] to-white p-6 rounded-2xl shadow-sm border-l-4 border-[#0056b3]"><div className="text-slate-500 font-bold uppercase text-xs mb-2">Total Bruto do Mês</div><div className="text-4xl font-black text-[#0056b3] tracking-tighter">R$ {totals.brutoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
          <div className="bg-gradient-to-r from-[#f0fff4] to-white p-6 rounded-2xl shadow-sm border-l-4 border-[#28a745]"><div className="text-slate-500 font-bold uppercase text-xs mb-2">Líquido Clínica (Mês)</div><div className="text-4xl font-black text-[#28a745] tracking-tighter">R$ {totals.liquidoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
        </section>

        {/* Ações Rápidas */}
        <section className="flex gap-4 justify-center flex-wrap mb-10">
          <button onClick={() => setActiveModal('prof')} className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white px-8 py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">⚕️ Novo Profissional</button>
          <button onClick={() => setActiveModal('patient')} className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white px-8 py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">👤 Novo Paciente</button>
          <button onClick={() => setActiveModal('patientList')} className="bg-gradient-to-br from-[#0056b3] to-[#004494] text-white px-8 py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">🔍 Lista de Pacientes</button>
          <button onClick={() => setActiveModal('stock')} className="bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white px-8 py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">📦 Estoque</button>
        </section>

        {/* Profissionais Cadastrados (AÇÃO CORRIGIDA) */}
        <section className="mb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {professionals.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200 font-bold">Nenhum profissional cadastrado.</div>
          ) : (
            professionals.map((prof) => (
              <div key={prof.id} className="relative bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-slate-800 text-lg truncate pr-2">{prof.name}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{prof.specialty || 'Geral'}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingProf(prof); setActiveModal('editProf'); }} className="text-indigo-500 bg-indigo-50 w-8 h-8 rounded-lg flex items-center justify-center text-xs hover:bg-indigo-500 hover:text-white transition-all">✏️</button>
                    <button onClick={() => { if(confirm(`Excluir ${prof.name}?`)) setProfessionals(prev => prev.filter(p => p.id !== prof.id)); }} className="text-red-500 bg-red-50 w-8 h-8 rounded-lg flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition-all">❌</button>
                  </div>
                </div>
                <div className="bg-[#f8f9fa] p-4 rounded-2xl border border-slate-100 flex justify-between items-center mt-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comissão</span>
                  <span className="text-xl font-black text-indigo-600">{prof.percentage}%</span>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Lançamentos Rápidos */}
        <div className="form-section bg-white p-10 rounded-3xl shadow-sm border border-slate-100 mb-8">
          <div className="flex gap-4 mb-10 border-b-2 border-slate-50 pb-6">
            <button onClick={() => setActiveTab('recebimento')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] transition-all ${activeTab === 'recebimento' ? 'bg-[#28a745] text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}>📥 Recebimento</button>
            <button onClick={() => setActiveTab('despesa')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] transition-all ${activeTab === 'despesa' ? 'bg-[#dc3545] text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}>💸 Despesa</button>
          </div>

          {activeTab === 'recebimento' ? (
            <form onSubmit={addReceipt}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-400 mb-2 tracking-widest">Valor Bruto</label>
                  <input name="value" type="number" step="0.01" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-emerald-500 outline-none font-bold text-xl" required placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-400 mb-2 tracking-widest">Profissional</label>
                  <select name="professional" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-indigo-500 outline-none font-bold" required>
                    <option value="">Escolher...</option>
                    {professionals.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2"><label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Serviço</label><button type="button" onClick={() => setActiveModal('manageServices')} className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-lg font-black uppercase">⚙️</button></div>
                  <select name="type" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-blue-500 outline-none font-bold" required>
                    {serviceTypes.map((t, i) => <option key={i} value={t.valor}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-400 mb-2 tracking-widest">Pagamento</label>
                  <select name="method" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-amber-500 outline-none font-bold" required>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="unimed">Unimed</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black rounded-2xl shadow-xl hover:translate-y-[-2px] transition-all uppercase tracking-[0.25em]">Salvar Lançamento</button>
            </form>
          ) : (
             <form onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               const val = parseFloat(fd.get('value') as string);
               if (isNaN(val)) return alert("Valor inválido");
               setExpenses(prev => [...prev, {
                 id: crypto.randomUUID(),
                 value: val,
                 category: fd.get('category') as string,
                 description: fd.get('desc') as string,
                 paymentMethod: fd.get('method') as string,
                 date: `${currentDate}T${new Date().toTimeString().split(' ')[0]}`
               }]);
               e.currentTarget.reset();
             }}>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
                 <input name="value" type="number" step="0.01" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" placeholder="Valor (0.00)" required />
                 <input name="category" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" placeholder="Categoria" required />
                 <input name="desc" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" placeholder="Descrição" required />
                 <select name="method" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" required>
                   <option value="pix">PIX</option>
                   <option value="cartao">Cartão</option>
                   <option value="dinheiro">Dinheiro</option>
                 </select>
               </div>
               <button type="submit" className="w-full py-5 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-black rounded-2xl shadow-xl hover:translate-y-[-2px] transition-all uppercase tracking-[0.25em]">Salvar Despesa</button>
             </form>
          )}
        </div>

        {/* Histórico Geral (AÇÃO CORRIGIDA) */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-24">
          <div className="p-8 border-b-2 border-slate-50 bg-[#f8f9fa]/50 flex justify-between items-center">
            <div><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter m-0">Histórico de Recebimentos</h3><p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest opacity-60">Dia: {new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] text-[10px] font-black text-slate-400 uppercase border-b-2 border-slate-100 tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Hora</th>
                  <th className="px-8 py-6">Profissional</th>
                  <th className="px-8 py-6">Valor Bruto</th>
                  <th className="px-8 py-6">Serviço</th>
                  <th className="px-8 py-6">Pagamento</th>
                  <th className="px-8 py-6 text-red-500">Valor Prof.</th>
                  <th className="px-8 py-6 text-emerald-600">Líquido Clínica</th>
                  <th className="px-8 py-6 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyReceipts.length === 0 ? (
                  <tr><td colSpan={8} className="px-8 py-20 text-center text-slate-300 font-black uppercase italic">Nenhum registro hoje.</td></tr>
                ) : (
                  dailyReceipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-blue-50/20 text-sm transition-all group">
                      <td className="px-8 py-6 font-black text-blue-500">{rec.date.split('T')[1]?.substring(0, 5)}</td>
                      <td className="px-8 py-6 font-black text-slate-800">{rec.professionalName}</td>
                      <td className="px-8 py-6 font-mono font-black text-slate-900">R$ {rec.grossValue.toFixed(2)}</td>
                      <td className="px-8 py-6 text-slate-500 font-bold">{serviceTypes.find(t => t.valor === rec.serviceType)?.nome || rec.serviceType}</td>
                      <td className="px-8 py-6"><span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">{rec.paymentMethod}</span></td>
                      <td className="px-8 py-6 font-mono font-black text-red-500">R$ {rec.professionalValue.toFixed(2)}</td>
                      <td className="px-8 py-6 font-mono font-black text-emerald-600">R$ {rec.netClinic.toFixed(2)}</td>
                      <td className="px-8 py-6 text-center">
                        <button onClick={() => { if(confirm("Excluir lançamento?")) setReceipts(prev => prev.filter(r => r.id !== rec.id)); }} className="text-slate-300 hover:text-red-500 transition-colors text-2xl group-hover:scale-110">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* --- MODAIS --- */}

      {/* Modal Editar Profissional */}
      {activeModal === 'editProf' && editingProf && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 border-b bg-[#f0f7ff] flex justify-between items-center"><h2 className="text-2xl font-black text-indigo-600 uppercase tracking-tighter">✏️ Editar Cadastro</h2><button onClick={() => { setActiveModal(null); setEditingProf(null); }} className="text-slate-400 text-4xl font-light hover:text-slate-600 transition-colors">&times;</button></div>
            <form onSubmit={handleEditProfSave} className="p-10 space-y-6">
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label><input name="name" defaultValue={editingProf.name} className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none focus:border-indigo-500" required /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Especialidade</label><input name="spec" defaultValue={editingProf.specialty} className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none focus:border-indigo-500" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Telefone</label><input name="phone" defaultValue={editingProf.phone} className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none focus:border-indigo-500" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Porcentagem (%)</label><input name="perc" type="number" defaultValue={editingProf.percentage} className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-black text-xl text-center" required /></div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest mt-6">Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Profissional */}
      {activeModal === 'prof' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 border-b bg-[#f8f9fa] flex justify-between items-center"><h2 className="text-2xl font-black text-[#0056b3] uppercase tracking-tighter">⚕️ Novo Profissional</h2><button onClick={() => { setActiveModal(null); setTemPorcentagem(null); }} className="text-slate-400 text-4xl font-light">&times;</button></div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if(temPorcentagem === null) return alert("Defina o regime de comissão.");
              const finalPerc = temPorcentagem ? parseInt(fd.get('perc') as string) : 100;
              setProfessionals(prev => [...prev, { id: crypto.randomUUID(), name: fd.get('name') as string, specialty: fd.get('spec') as string, phone: fd.get('phone') as string, percentage: finalPerc, createdAt: new Date().toISOString() }]);
              setActiveModal(null); setTemPorcentagem(null);
            }} className="p-10 space-y-6">
              <input name="name" className="w-full p-5 border-2 border-slate-200 rounded-2xl bg-white font-bold text-lg" placeholder="Nome Completo" required />
              <input name="spec" className="w-full p-5 border-2 border-slate-200 rounded-2xl bg-white font-bold" placeholder="Especialidade" />
              <input name="phone" className="w-full p-5 border-2 border-slate-200 rounded-2xl bg-white font-bold" placeholder="WhatsApp" />
              <div className="flex gap-4"><button type="button" onClick={() => setTemPorcentagem(true)} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase transition-all ${temPorcentagem===true ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>✅ Tem Comissão</button><button type="button" onClick={() => setTemPorcentagem(false)} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase transition-all ${temPorcentagem===false ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>❌ Sem Comissão</button></div>
              {temPorcentagem === true && <input name="perc" type="number" className="w-full p-5 border-2 border-slate-200 rounded-2xl bg-white font-black text-xl text-center" placeholder="Qual o %?" required />}
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] mt-6">Confirmar Cadastro</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Estoque */}
      {activeModal === 'stock' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 border-b bg-amber-50/50 flex justify-between items-center"><h2 className="text-2xl font-black text-amber-700 uppercase tracking-tighter">📦 Estoque</h2><button onClick={() => setActiveModal(null)} className="text-slate-400 text-4xl font-light hover:text-slate-600 transition-colors">&times;</button></div>
            <div className="p-10">
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setProducts(prev => [...prev, { id: crypto.randomUUID(), name: fd.get('name') as string, quantity: parseInt(fd.get('qty') as string), minQuantity: parseInt(fd.get('min') as string) }]);
                e.currentTarget.reset();
              }} className="flex gap-4 mb-10 p-8 bg-slate-50 rounded-3xl border border-slate-200">
                <input name="name" className="flex-1 p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold" placeholder="Produto" required />
                <input name="qty" type="number" className="w-28 p-4 border-2 border-slate-200 rounded-2xl bg-white text-center font-black" placeholder="Qtd" required />
                <input name="min" type="number" className="w-28 p-4 border-2 border-slate-200 rounded-2xl bg-white text-center font-black" placeholder="Mín" required />
                <button type="submit" className="bg-amber-600 text-white px-8 rounded-2xl font-black shadow-lg">Adicionar</button>
              </form>
              <div className="max-h-[40vh] overflow-y-auto space-y-3">
                {products.map(p => (
                  <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group">
                    <div className="flex-1 font-black text-slate-800 uppercase">{p.name}</div>
                    <div className="flex items-center gap-4">
                      <div className="text-xl font-black text-blue-600">{p.quantity} <span className="text-[10px] text-slate-400 uppercase">UN</span></div>
                      <div className="flex gap-1">
                        <button onClick={() => setProducts(prev => prev.map(x => x.id === p.id && x.quantity > 0 ? {...x, quantity: x.quantity - 1} : x))} className="w-10 h-10 bg-slate-100 rounded-lg font-black text-red-500 hover:bg-red-50">-</button>
                        <button onClick={() => setProducts(prev => prev.map(x => x.id === p.id ? {...x, quantity: x.quantity + 1} : x))} className="w-10 h-10 bg-slate-100 rounded-lg font-black text-emerald-500 hover:bg-emerald-50">+</button>
                        <button onClick={() => { if(confirm("Remover?")) setProducts(prev => prev.filter(x => x.id !== p.id)); }} className="ml-4 text-slate-300 hover:text-red-500 transition-colors">🗑️</button>
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
