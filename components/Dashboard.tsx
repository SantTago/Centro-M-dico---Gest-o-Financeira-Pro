
import React, { useState, useEffect, useMemo } from 'react';
import { Professional, Patient, Receipt, Expense, Product, DailyConfig } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface DashboardProps {
  onLogout: () => void;
}

const STORAGE_KEY = 'centroMedicoCamocim_v100';

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  // --- Estados Principais ---
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
  
  // Filtros/Buscas
  const [stockSearch, setStockSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'todos' | 'baixo' | 'zerado'>('todos');
  const [temPorcentagem, setTemPorcentagem] = useState<boolean | null>(null);

  // --- Persistência ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setProfessionals(data.professionals || []);
        setPatients(data.patients || []);
        setReceipts(data.receipts || []);
        setExpenses(data.expenses || []);
        setProducts(data.products || []);
        setDailyConfigs(data.dailyConfigs || []);
        if (data.serviceTypes) setServiceTypes(data.serviceTypes);
      } catch (e) { console.error("Erro ao carregar", e); }
    }
  }, []);

  useEffect(() => {
    const data = { professionals, patients, receipts, expenses, products, dailyConfigs, serviceTypes };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [professionals, patients, receipts, expenses, products, dailyConfigs, serviceTypes]);

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

  // --- Handlers ---
  const addReceipt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const profIndex = parseInt(formData.get('professional') as string);
    const prof = professionals[profIndex];
    if (!prof) return alert("Selecione um profissional");

    const gross = parseFloat(formData.get('value') as string);
    const profValue = prof.percentage === 100 ? 0 : gross * (prof.percentage / 100);
    const net = gross - profValue;

    const localFullDate = `${currentDate}T${new Date().toTimeString().split(' ')[0]}`;

    const newRec: Receipt = {
      id: Date.now().toString(),
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

  const addExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const val = parseFloat(formData.get('value') as string);
    const localFullDate = `${currentDate}T${new Date().toTimeString().split(' ')[0]}`;

    setExpenses(prev => [...prev, {
      id: Date.now().toString(),
      value: val,
      category: formData.get('category') as string,
      description: formData.get('desc') as string,
      paymentMethod: formData.get('method') as string,
      date: localFullDate
    }]);
    e.currentTarget.reset();
  };

  const handleEditProf = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProf) return;
    const fd = new FormData(e.currentTarget);
    const updated = professionals.map(p => p.id === editingProf.id ? {
      ...p,
      name: fd.get('name') as string,
      specialty: fd.get('spec') as string,
      phone: fd.get('phone') as string,
      percentage: parseInt(fd.get('perc') as string) || 100
    } : p);
    setProfessionals(updated);
    setActiveModal(null);
    setEditingProf(null);
  };

  const pieData = [
    { name: 'Cartão', value: totals.cardMes, color: '#ff6384' },
    { name: 'PIX', value: totals.pixMes, color: '#4bc0c0' },
    { name: 'Dinheiro', value: totals.moneyMes, color: '#ffcd56' },
    { name: 'Unimed', value: totals.unimedMes, color: '#9966ff' },
  ].filter(d => d.value > 0);

  // --- Detalhamento Profissional (Modal) ---
  const selectedProfDetails = useMemo(() => {
    if (selectedProfIndex === null) return null;
    const prof = professionals[selectedProfIndex];
    const profRecs = dailyReceipts.filter(r => r.professionalId === prof.id);
    const paymentTotals = { pix: 0, dinheiro: 0, cartao: 0, unimed: 0 };
    profRecs.forEach(r => { if(paymentTotals.hasOwnProperty(r.paymentMethod)) (paymentTotals as any)[r.paymentMethod] += r.grossValue; });
    const bVal = profRecs.reduce((s, r) => s + r.grossValue, 0);
    const pVal = profRecs.reduce((s, r) => s + r.professionalValue, 0);
    const cVal = profRecs.reduce((s, r) => s + r.netClinic, 0);
    return { prof, profRecs, paymentTotals, bVal, pVal, cVal };
  }, [selectedProfIndex, dailyReceipts, professionals]);

  return (
    <div className="dashboard-wrapper min-h-screen bg-[#f4f4f9] p-8">
      <div className="dashboard-container max-w-[1400px] mx-auto">
        
        {/* Header */}
        <header className="header flex items-center gap-5 mb-8 flex-wrap">
          <div className="logo-placeholder w-16 h-16 bg-gradient-to-br from-[#0056b3] to-[#0084d4] rounded-xl flex items-center justify-center text-3xl shadow-lg">🏥</div>
          <div className="flex-1">
            <h1 className="main-title text-3xl font-bold text-[#0056b3] m-0">Controle Financeiro Centro Médico</h1>
            <div className="text-sm opacity-90 mt-1">Gestão completa de recebimentos, despesas e comissões</div>
          </div>
          <div className="flex gap-3">
            <button className="header-btn bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold shadow">📥 Exportar</button>
            <button className="header-btn bg-white text-slate-700 px-6 py-3 rounded-lg font-semibold shadow border border-slate-200">📤 Importar</button>
            <button onClick={() => { if(confirm("Apagar tudo?")) { localStorage.clear(); location.reload(); } }} className="header-btn bg-red-500 text-white px-6 py-3 rounded-lg font-semibold shadow">🗑️ Limpar Tudo</button>
            <button onClick={onLogout} className="bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-semibold shadow">Sair</button>
          </div>
        </header>

        {/* Navegação por Dia */}
        <section className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-slate-100">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-bold text-slate-800 m-0">📅 Navegação por Dia</h2>
            <button onClick={() => setCurrentDate(new Date().toLocaleDateString('en-CA'))} className="px-5 py-2.5 bg-gradient-to-r from-[#0056b3] to-[#004494] text-white font-bold rounded-lg shadow-md">📌 Voltar para Hoje</button>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={() => {
              const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
              setCurrentDate(d.toLocaleDateString('en-CA'));
            }} className="bg-[#6c757d] text-white px-5 py-3 rounded-lg font-bold">← Dia Anterior</button>
            <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-10 py-4 rounded-xl text-center min-w-[320px] shadow-lg">
              <div className="text-xs opacity-90 mb-1 uppercase tracking-widest">Visualizando</div>
              <div className="text-2xl font-bold">{new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <button onClick={() => {
              const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
              setCurrentDate(d.toLocaleDateString('en-CA'));
            }} className="bg-[#6c757d] text-white px-5 py-3 rounded-lg font-bold">Próximo Dia →</button>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <div className="text-sm text-slate-500 font-bold mb-4 uppercase tracking-widest text-[#0056b3]">📊 Resumo do Dia Selecionado</div>
            <div className="flex justify-center gap-10 flex-wrap">
              <div className="flex flex-col"><span className="text-[11px] text-slate-400 font-black uppercase">Recebimentos:</span><strong className="text-xl text-emerald-500">R$ {dailyTotals.rec.toFixed(2)}</strong></div>
              <div className="flex flex-col"><span className="text-[11px] text-slate-400 font-black uppercase">Despesas:</span><strong className="text-xl text-red-500">R$ {dailyTotals.exp.toFixed(2)}</strong></div>
              <div className="flex flex-col"><span className="text-[11px] text-slate-400 font-black uppercase">Liquido:</span><strong className="text-xl text-blue-600">R$ {dailyTotals.liq.toFixed(2)}</strong></div>
            </div>
          </div>
        </section>

        {/* Totais Mensais */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-[#f0f7ff] to-white p-6 rounded-2xl shadow-sm border-l-4 border-[#0056b3]"><div className="text-slate-500 font-bold uppercase text-xs mb-2">Total Bruto Recebido (Mês)</div><div className="text-4xl font-bold text-[#0056b3]">R$ {totals.brutoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
          <div className="bg-gradient-to-r from-[#f0fff4] to-white p-6 rounded-2xl shadow-sm border-l-4 border-[#28a745]"><div className="text-slate-500 font-bold uppercase text-xs mb-2">Total Líquido Clínica (Mês)</div><div className="text-4xl font-bold text-[#28a745]">R$ {totals.liquidoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
        </section>

        {/* Botões de Ação Principais (Corrigidos) */}
        <section className="flex gap-4 justify-center flex-wrap mb-10">
          <button onClick={() => setActiveModal('prof')} className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white px-8 py-5 rounded-xl font-bold shadow-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95"><span className="text-2xl">⚕️</span> <span>Cadastrar Novo Profissional</span></button>
          <button onClick={() => setActiveModal('patient')} className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white px-8 py-5 rounded-xl font-bold shadow-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95"><span className="text-2xl">👤</span> <span>Cadastrar Novo Paciente</span></button>
          <button onClick={() => setActiveModal('patientList')} className="bg-gradient-to-br from-[#0056b3] to-[#004494] text-white px-8 py-5 rounded-xl font-bold shadow-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95"><span className="text-2xl">🔍</span> <span>Ver Lista de Pacientes</span></button>
          <button onClick={() => setActiveModal('stock')} className="bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white px-8 py-5 rounded-xl font-bold shadow-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95"><span className="text-2xl">📦</span> <span>Estoque de Produtos</span></button>
        </section>

        {/* Gerenciamento de Profissionais */}
        <section className="mb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {professionals.length === 0 ? (
            <div className="col-span-full text-center py-10 text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200 font-bold">⚕️ Nenhum profissional cadastrado.</div>
          ) : (
            professionals.map(prof => (
              <div key={prof.id} className="relative bg-white p-6 rounded-2xl border-2 border-[#e9ecef] shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#667eea] to-[#764ba2]"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-slate-800 text-lg">{prof.name}</div>
                    <div className="text-xs text-slate-500 font-bold uppercase">{prof.specialty || 'Profissional'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => { setEditingProf(prof); setActiveModal('editProf'); }} className="text-indigo-500 bg-indigo-50 px-2 py-1 rounded text-[9px] font-black uppercase">✏️</button>
                    <button onClick={() => { if(confirm(`Remover ${prof.name}?`)) setProfessionals(professionals.filter(p => p.id !== prof.id)); }} className="text-red-500 bg-red-50 px-2 py-1 rounded text-[9px] font-black uppercase">❌</button>
                  </div>
                </div>
                <div className="bg-[#f8f9fa] p-3 rounded-xl border border-slate-100 flex justify-between items-center mt-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Percentual</span>
                  <span className="text-lg font-black text-indigo-600">{prof.percentage}%</span>
                </div>
              </div>
            ))
          )}
        </section>

        {/* --- [ORDEM: 1] FORMULÁRIO DE LANÇAMENTO (Inputs Brancos) --- */}
        <div className="form-section bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-8">
          <div className="flex gap-4 mb-8 border-b-2 border-slate-50 pb-4">
            <button onClick={() => setActiveTab('recebimento')} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'recebimento' ? 'bg-[#28a745] text-white shadow-lg' : 'bg-[#f8f9fa] text-slate-400'}`}>📥 Recebimento</button>
            <button onClick={() => setActiveTab('despesa')} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'despesa' ? 'bg-[#dc3545] text-white shadow-lg' : 'bg-[#f8f9fa] text-slate-400'}`}>💸 Despesa</button>
          </div>

          <div className="flex items-center justify-center gap-6 mb-10 flex-wrap">
            <div className="bg-gradient-to-r from-[#10b981] to-[#059669] p-6 rounded-2xl text-white text-center shadow-xl min-w-[300px]">
              <div className="text-[10px] uppercase font-black opacity-80 mb-2">💰 Valor Inicial do Caixa</div>
              <div className="text-4xl font-black tracking-tighter">R$ {initialCash.toFixed(2)}</div>
            </div>
            <button onClick={() => setActiveModal('cash')} className="bg-white text-[#10b981] border-2 border-[#10b981] px-8 py-4 rounded-xl font-black text-xs uppercase hover:bg-[#10b981] hover:text-white transition-all">✏️ Editar Valor</button>
          </div>

          {activeTab === 'recebimento' ? (
            <form onSubmit={addReceipt}>
              <h2 className="text-xl font-black text-slate-800 mb-8 pb-3 border-b uppercase">Registrar Novo Recebimento</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Valor Bruto</label>
                  <input name="value" type="number" step="0.01" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-emerald-500 outline-none font-bold text-lg" required placeholder="R$ 0,00" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Profissional</label>
                  <select name="professional" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-indigo-500 outline-none font-bold" required>
                    <option value="">Selecione...</option>
                    {professionals.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2"><label className="text-[11px] font-black uppercase text-slate-500">Tipo Atendimento</label><button type="button" onClick={() => setActiveModal('manageServices')} className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase">⚙️</button></div>
                  <select name="type" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-blue-500 outline-none font-bold" required>
                    <option value="">Selecione...</option>
                    {serviceTypes.map((t, i) => <option key={i} value={t.valor}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Pagamento</label>
                  <select name="method" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white focus:border-amber-500 outline-none font-bold" required>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="unimed">Unimed</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black rounded-2xl shadow-xl hover:scale-[1.01] transition-all uppercase tracking-[0.2em]">Adicionar Recebimento</button>
            </form>
          ) : (
            <form onSubmit={addExpense}>
              <h2 className="text-xl font-black text-slate-800 mb-8 pb-3 border-b uppercase">Registrar Nova Despesa</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <input name="value" type="number" step="0.01" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" placeholder="Valor (0.00)" required />
                <input name="category" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" placeholder="Categoria" required />
                <input name="desc" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" placeholder="Descrição" required />
                <select name="method" className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-white font-bold outline-none" required>
                  <option value="pix">PIX</option>
                  <option value="cartao">Cartão</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
              <button type="submit" className="w-full py-5 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-black rounded-2xl shadow-xl hover:scale-[1.01] transition-all uppercase tracking-[0.2em]">Adicionar Despesa</button>
            </form>
          )}
        </div>

        {/* --- [ORDEM: 2] RESUMO POR CONTA --- */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Cartão', key: 'cartao', color: '#ff6384', icon: '💳' },
            { label: 'PIX', key: 'pix', color: '#4bc0c0', icon: '⚡' },
            { label: 'Dinheiro', key: 'dinheiro', color: '#ffcd56', icon: '💵' },
            { label: 'Unimed', key: 'unimed', color: '#9966ff', icon: '🏥' }
          ].map((item) => {
            const val = dailyAccountTotals[item.key as keyof typeof dailyAccountTotals] || 0;
            return (
              <div key={item.label} className="p-6 rounded-2xl text-white shadow-lg flex flex-col items-center justify-center transition-all hover:translate-y-[-2px]" style={{ background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}cc 100%)` }}>
                <div className="text-[10px] font-black uppercase opacity-80 mb-2 tracking-[0.2em]">{item.icon} {item.label} (Hoje)</div>
                <div className="text-3xl font-black tracking-tighter">R$ {val.toFixed(2)}</div>
              </div>
            );
          })}
        </section>

        {/* --- [ORDEM: 3] DETALHAMENTO POR PROFISSIONAL --- */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-12">
          <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Detalhamento por Profissional (Dia)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {professionals.length === 0 || dailyReceipts.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 font-black uppercase tracking-widest">📊 Nenhum recebimento neste dia</div>
            ) : (
              professionals.map((prof, idx) => {
                const profRecs = dailyReceipts.filter(r => r.professionalId === prof.id);
                if (profRecs.length === 0) return null;
                const bVal = profRecs.reduce((s, r) => s + r.grossValue, 0);
                const pVal = profRecs.reduce((s, r) => s + r.professionalValue, 0);
                const cVal = profRecs.reduce((s, r) => s + r.netClinic, 0);
                return (
                  <div key={prof.id} className="p-5 rounded-2xl border-2 border-slate-50 bg-white hover:shadow-xl hover:translate-y-[-4px] transition-all cursor-pointer group" onClick={() => { setSelectedProfIndex(idx); setActiveModal('profDetail'); }}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-full flex items-center justify-center text-xl shadow-lg">⚕️</div>
                      <div className="flex-1">
                        <div className="font-black text-slate-800 tracking-tight">{prof.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{profRecs.length} atendimentos • {prof.percentage}%</div>
                      </div>
                      <div className="text-xl text-indigo-200 group-hover:text-indigo-500">👁️</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-50 pt-5">
                      <div><div className="text-[9px] font-black text-slate-400 uppercase">Bruto</div><div className="text-sm font-black">R$ {bVal.toFixed(2)}</div></div>
                      <div className="border-x px-2"><div className="text-[9px] font-black text-indigo-400 uppercase">Prof.</div><div className="text-sm font-black text-indigo-600">R$ {pVal.toFixed(2)}</div></div>
                      <div><div className="text-[9px] font-black text-emerald-400 uppercase">Clínica</div><div className="text-sm font-black text-emerald-600">R$ {cVal.toFixed(2)}</div></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* --- [ORDEM: 4] GRÁFICOS --- */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[380px]">
            <h3 className="text-lg font-bold text-slate-700 mb-6 uppercase tracking-tighter text-center">Formas de Pagamento (Mês)</h3>
            <ResponsiveContainer width="100%" height="90%"><PieChart><Pie data={pieData} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[380px]">
            <h3 className="text-lg font-bold text-slate-700 mb-6 uppercase tracking-tighter text-center">Atendimentos (Mês)</h3>
            <ResponsiveContainer width="100%" height="90%"><BarChart data={barData}><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip cursor={{fill: '#f1f5f9'}} /><Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </section>

        {/* --- [ORDEM: 5] HISTÓRICO DE RECEBIMENTOS --- */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-20">
          <div className="p-6 border-b-2 border-slate-50 bg-[#f8f9fa]/50 flex justify-between items-center">
            <div><h3 className="text-xl font-black text-slate-800 uppercase m-0">Histórico de Recebimentos</h3><p className="text-xs text-slate-500 mt-1 font-bold">Listagem do dia selecionado</p></div>
            <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg">{new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] text-[10px] font-black text-slate-500 uppercase border-b-2 border-slate-100">
                <tr><th className="px-6 py-5">Data</th><th className="px-6 py-5">Hora</th><th className="px-6 py-5">Profissional</th><th className="px-6 py-5">Valor Bruto</th><th className="px-6 py-5">Atendimento</th><th className="px-6 py-5">Pagamento</th><th className="px-6 py-5 text-[#dc3545]">Valor Prof..</th><th className="px-6 py-5 text-[#28a745]">Líquido Clínica</th><th className="px-6 py-5 text-center">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyReceipts.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-24 text-center text-slate-400 font-black uppercase opacity-30">📋 Nenhum recebimento registrado</td></tr>
                ) : (
                  dailyReceipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-blue-50/30 text-sm transition-colors group">
                      <td className="px-6 py-5 font-bold text-slate-400">{new Date(rec.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-5 font-black text-slate-400">{rec.date.split('T')[1]?.substring(0, 5)}</td>
                      <td className="px-6 py-5 font-black text-slate-800">{rec.professionalName}</td>
                      <td className="px-6 py-5 font-mono font-black">R$ {rec.grossValue.toFixed(2)}</td>
                      <td className="px-6 py-5 text-slate-600 capitalize font-bold">{serviceTypes.find(t => t.valor === rec.serviceType)?.nome || rec.serviceType}</td>
                      <td className="px-6 py-5"><span className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-600">{rec.paymentMethod}</span></td>
                      <td className="px-6 py-5 font-mono font-black text-red-500">R$ {rec.professionalValue.toFixed(2)}</td>
                      <td className="px-6 py-5 font-mono font-black text-emerald-600">R$ {rec.netClinic.toFixed(2)}</td>
                      <td className="px-6 py-5 text-center"><button onClick={() => {if(confirm("Excluir?")) setReceipts(receipts.filter(r=>r.id!==rec.id))}} className="text-slate-300 hover:text-red-500 transition-colors">🗑️</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* --- MODAIS (REVISADOS E FUNCIONAIS) --- */}

      {/* Modal Detalhamento Profissional (Completo) */}
      {activeModal === 'profDetail' && selectedProfDetails && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl shadow-2xl p-10 my-10 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-10"><h2 className="text-3xl font-black text-slate-800 uppercase">📊 Detalhamento Completo</h2><button onClick={() => { setActiveModal(null); setSelectedProfIndex(null); }} className="bg-slate-100 hover:bg-slate-200 text-slate-500 w-14 h-14 rounded-full flex items-center justify-center text-4xl font-light shadow-sm transition-all">&times;</button></div>
            <div className="flex justify-between items-center mb-8 p-8 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2rem] text-white shadow-2xl shadow-indigo-200">
              <div className="flex items-center gap-6"><div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl">⚕️</div><div><h3 className="text-4xl font-black mb-2">{selectedProfDetails.prof.name}</h3><div className="text-sm font-bold opacity-80 uppercase tracking-widest">{selectedProfDetails.profRecs.length} atendimentos • {selectedProfDetails.prof.percentage}% Percentual</div></div></div>
              <div className="text-right"><div className="text-xs font-black uppercase opacity-70 mb-2">Líquido Profissional</div><div className="text-5xl font-black tracking-tighter">R$ {selectedProfDetails.pVal.toFixed(2)}</div></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {Object.entries(selectedProfDetails.paymentTotals).map(([method, val]) => (
                <div key={method} className="bg-slate-50 p-6 rounded-[1.5rem] border-2 border-slate-100 text-center"><div className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{method}</div><div className="text-2xl font-black text-slate-800 tracking-tighter">R$ {(val as number).toFixed(2)}</div></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 p-10 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
              <div className="text-center"><div className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">💰 Total Bruto</div><div className="text-4xl font-black text-slate-800">R$ {selectedProfDetails.bVal.toFixed(2)}</div></div>
              <div className="text-center border-x-2 border-slate-200"><div className="text-xs font-black text-indigo-500 uppercase mb-3 tracking-widest">⚕️ Profissional</div><div className="text-4xl font-black text-indigo-700">R$ {selectedProfDetails.pVal.toFixed(2)}</div></div>
              <div className="text-center"><div className="text-xs font-black text-emerald-500 uppercase mb-3 tracking-widest">🏥 Clínica</div><div className="text-4xl font-black text-emerald-700">R$ {selectedProfDetails.cVal.toFixed(2)}</div></div>
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-3"><span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">📋</span> Atendimentos</h4>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                {selectedProfDetails.profRecs.map((rec, idx) => (
                  <div key={rec.id} className="bg-white p-6 rounded-[1.5rem] border-2 border-slate-50 flex items-center gap-6 shadow-sm">
                    <div className="bg-indigo-50 rounded-2xl w-12 h-12 flex items-center justify-center font-black text-indigo-600">{idx+1}</div>
                    <div className="flex-1"><div className="text-lg font-black text-slate-800 uppercase">{serviceTypes.find(t=>t.valor===rec.serviceType)?.nome || rec.serviceType}</div><div className="text-xs text-slate-400 font-bold">{rec.paymentMethod.toUpperCase()} • {rec.date.split('T')[1].substring(0,5)}</div></div>
                    <div className="text-right font-black text-slate-900">R$ {rec.grossValue.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro Profissional */}
      {activeModal === 'prof' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b bg-[#f8f9fa] flex justify-between items-center"><h2 className="text-xl font-bold text-[#0056b3]">⚕️ Novo Profissional</h2><button onClick={() => { setActiveModal(null); setTemPorcentagem(null); }} className="text-slate-400 text-3xl font-light">&times;</button></div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if(temPorcentagem === null) return alert("Defina a porcentagem");
              setProfessionals([...professionals, { id: Date.now().toString(), name: fd.get('name') as string, specialty: fd.get('spec') as string, phone: fd.get('phone') as string, percentage: temPorcentagem ? parseInt(fd.get('perc') as string) : 100, createdAt: new Date().toISOString() }]);
              setActiveModal(null); setTemPorcentagem(null);
            }} className="p-8 space-y-5">
              <input name="name" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-500" placeholder="Nome Completo" required />
              <input name="spec" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-500" placeholder="Especialidade" />
              <input name="phone" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-500" placeholder="Telefone" />
              <div className="flex gap-4"><button type="button" onClick={() => setTemPorcentagem(true)} className={`flex-1 py-3 rounded-xl font-bold ${temPorcentagem===true ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>✅ Com Porcentagem</button><button type="button" onClick={() => setTemPorcentagem(false)} className={`flex-1 py-3 rounded-xl font-bold ${temPorcentagem===false ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'}`}>❌ Sem Porcentagem</button></div>
              {temPorcentagem === true && <input name="perc" type="number" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white" placeholder="Porcentagem (%)" required />}
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Cadastrar Profissional</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lista de Pacientes (FUNCIONAL) */}
      {activeModal === 'patientList' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b bg-[#f8f9fa] flex justify-between items-center"><h2 className="text-xl font-bold text-[#0056b3]">📋 Lista de Pacientes ({patients.length})</h2><button onClick={() => setActiveModal(null)} className="text-slate-400 text-3xl font-light">&times;</button></div>
            <div className="p-8">
              <input type="text" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="🔍 Pesquisar paciente pelo nome..." className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl outline-none mb-6 focus:border-blue-400 shadow-inner" />
              <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {patients.length === 0 ? (
                   <div className="text-center py-10 text-slate-400 font-bold uppercase">Nenhum paciente cadastrado</div>
                ) : (
                  patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase())).map(p => (
                    <div key={p.id} className="bg-white p-6 rounded-2xl border-2 border-slate-50 flex items-center gap-6 group hover:border-blue-200 transition-all shadow-sm">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl">👤</div>
                      <div className="flex-1"><div className="text-lg font-black text-slate-800">{p.name}</div><div className="text-xs text-slate-500 font-bold">📞 {p.phone} • 📧 {p.email || 'N/A'}</div></div>
                      <button onClick={() => { if(confirm(`Excluir ${p.name}?`)) setPatients(patients.filter(x => x.id !== p.id)); }} className="text-red-400 hover:text-red-600 font-bold">🗑️</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Estoque de Produtos (FUNCIONAL) */}
      {activeModal === 'stock' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b bg-[#fffbeb] flex justify-between items-center"><h2 className="text-xl font-bold text-[#b45309]">📦 Controle de Estoque</h2><button onClick={() => setActiveModal(null)} className="text-slate-400 text-3xl font-light">&times;</button></div>
            <div className="p-8">
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setProducts([...products, { id: Date.now().toString(), name: fd.get('name') as string, quantity: parseInt(fd.get('qty') as string), minQuantity: parseInt(fd.get('min') as string) }]);
                e.currentTarget.reset();
              }} className="flex gap-3 mb-8 p-6 bg-slate-50 rounded-2xl border">
                <input name="name" className="flex-1 p-3 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-amber-400" placeholder="Nome do Produto" required />
                <input name="qty" type="number" className="w-24 p-3 border-2 border-slate-200 rounded-xl bg-white text-center" placeholder="Qtd" required />
                <input name="min" type="number" className="w-24 p-3 border-2 border-slate-200 rounded-xl bg-white text-center" placeholder="Mín" required />
                <button type="submit" className="bg-[#d97706] text-white px-6 rounded-xl font-bold shadow-md">+ Add</button>
              </form>
              <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase border-b"><tr className="divide-x divide-transparent"><th className="px-4 py-4">Produto</th><th className="px-4 py-4">Qtd</th><th className="px-4 py-4">Mín</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-center">Ações</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map(p => (
                      <tr key={p.id} className={p.quantity <= p.minQuantity ? 'bg-amber-50/50' : ''}>
                        <td className="px-4 py-4 font-bold text-slate-700">{p.name}</td>
                        <td className="px-4 py-4 font-black">{p.quantity}</td>
                        <td className="px-4 py-4 text-slate-400">{p.minQuantity}</td>
                        <td className="px-4 py-4">{p.quantity <= p.minQuantity ? <b className="text-amber-600 text-[10px]">⚠️ BAIXO</b> : <b className="text-emerald-500 text-[10px]">✅ OK</b>}</td>
                        <td className="px-4 py-4 flex justify-center gap-2">
                          <button onClick={() => { const n = [...products]; const i = n.findIndex(x=>x.id===p.id); if(n[i].quantity > 0) n[i].quantity--; setProducts(n); }} className="bg-white border w-8 h-8 rounded text-red-500 font-bold">-1</button>
                          <button onClick={() => { const n = [...products]; const i = n.findIndex(x=>x.id===p.id); n[i].quantity++; setProducts(n); }} className="bg-white border w-8 h-8 rounded text-emerald-500 font-bold">+1</button>
                          <button onClick={() => setProducts(products.filter(x=>x.id!==p.id))} className="text-slate-300 ml-4 hover:text-red-500">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outros Modais (Cadastro de Paciente, Caixa, etc.) */}
      {activeModal === 'patient' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
            <div className="p-6 border-b bg-[#f0fff4] flex justify-between items-center"><h2 className="text-xl font-bold text-[#059669]">👤 Novo Paciente</h2><button onClick={() => setActiveModal(null)} className="text-slate-400 text-3xl font-light">&times;</button></div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setPatients([...patients, { id: Date.now().toString(), name: fd.get('name') as string, phone: fd.get('phone') as string, email: fd.get('email') as string, address: fd.get('addr') as string, birthDate: fd.get('birth') as string, createdAt: new Date().toISOString() }]);
              alert("✅ Sucesso!"); setActiveModal(null);
            }} className="p-8 space-y-5">
              <input name="name" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-emerald-500" placeholder="Nome Completo" required />
              <input name="phone" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-emerald-500" placeholder="Telefone" required />
              <input name="birth" type="date" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-emerald-500" />
              <input name="email" className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-emerald-500" placeholder="Email" />
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg">Cadastrar Paciente</button>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'cash' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center animate-in zoom-in">
            <h2 className="text-xl font-black text-[#059669] mb-6 uppercase">💰 Valor do Caixa</h2>
            <form onSubmit={(e) => {
              e.preventDefault(); const val = parseFloat(new FormData(e.currentTarget).get('cash') as string);
              const idx = dailyConfigs.findIndex(c => c.date === currentDate);
              if(idx >= 0) { const nc = [...dailyConfigs]; nc[idx].initialCash = val; setDailyConfigs(nc); }
              else setDailyConfigs([...dailyConfigs, { date: currentDate, initialCash: val }]);
              setActiveModal(null);
            }} className="space-y-6">
              <input name="cash" type="number" step="0.01" className="w-full p-4 border-2 border-slate-200 rounded-2xl text-2xl font-black text-center bg-white outline-none focus:border-emerald-500" autoFocus defaultValue={initialCash} />
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-md">Salvar Valor</button>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'manageServices' && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 animate-in zoom-in">
            <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-slate-800 uppercase">⚙️ Serviços</h3><button onClick={() => setActiveModal(null)} className="text-3xl opacity-30">&times;</button></div>
            <form onSubmit={(e) => {
              e.preventDefault(); const name = (e.currentTarget.elements[0] as HTMLInputElement).value; if(!name) return;
              setServiceTypes([...serviceTypes, { nome: name, valor: name.toLowerCase().replace(/ /g, '_') }]); e.currentTarget.reset();
            }} className="flex gap-2 mb-6"><input className="flex-1 p-3 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-blue-400" placeholder="Novo..." /><button className="bg-emerald-500 text-white px-4 rounded-xl font-bold">Add</button></form>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">{serviceTypes.map((t, i) => (<div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><span className="text-sm font-bold">{t.nome}</span><button onClick={() => setServiceTypes(serviceTypes.filter((_, idx)=>idx!==i))} className="text-red-400 font-bold">Remover</button></div>))}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
