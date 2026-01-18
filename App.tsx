
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Building, 
  Hash, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  ShieldCheck, 
  Loader2, 
  TrendingUp,
  BrainCircuit,
  Download,
  Lock,
  Info,
  ExternalLink,
  KeyRound,
  LogOut,
  ChevronRight,
  Database
} from 'lucide-react';
import { TaxRecord, AppMessage, LoadingState } from './types';
import { parseCSVRow, parseNumber } from './services/csvService';
import { getTaxInsights } from './services/geminiService';

const DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAstBXE5hbO14W9dWz-wDU1h4tve42LjLNq1uN3WjpHDgst5J_F4VO8enZS3q5e2YOM9hRNBkuCt0a/pub?output=csv";
const APP_PASSWORD = "abc@2025";

const App: React.FC = () => {
  // --- Authentication States ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('is_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // --- Main States ---
  const [data, setData] = useState<TaxRecord[]>([]);
  const [loading, setLoading] = useState<LoadingState>(LoadingState.FETCHING_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<TaxRecord | null>(null);
  const [msg, setMsg] = useState<AppMessage>({ type: '', text: '' });
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [showConfigAlert, setShowConfigAlert] = useState(false);

  // --- Tính toán tổng cột SL (Tổng số hóa đơn toàn hệ thống) ---
  const globalStats = useMemo(() => {
    return {
      totalRecords: data.length,
      totalInvoices: data.reduce((sum, item) => sum + (item.SL || 0), 0)
    };
  }, [data]);

  // --- Logic Đăng nhập ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('is_auth', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('is_auth');
    setSearchResult(null);
    setSearchTerm('');
  };

  // --- Kiểm tra cấu hình & Chặn phím tắt ---
  useEffect(() => {
    if (!process.env.API_KEY) {
      console.warn("CẢNH BÁO: API_KEY chưa được cấu hình.");
    }

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(LoadingState.FETCHING_DATA);
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error();
      const text = await response.text();
      const rows = text.split(/\r?\n/);
      const parsedData: TaxRecord[] = [];

      for (let i = 1; i < rows.length; i++) {
        const cols = parseCSVRow(rows[i]);
        if (cols.length >= 2) {
          // CHUẨN HÓA MST: Xóa bỏ khoảng trắng, dấu ngoặc và dấu gạch ngang (-) 
          // để đồng bộ với logic tìm kiếm (Ví dụ: 8077806911-001 trở thành 8077806911001)
          const mst = cols[1].replace(/['"\s-]/g, ''); 
          if (mst.length >= 5) {
            parsedData.push({
              CQT: cols[0] ? cols[0].replace('.0', '') : 'N/A',
              MST: mst,
              Ten: cols[2] || 'Không xác định',
              SL: parseNumber(cols[3]),
              Thue: parseNumber(cols[4]),
              TongTien: parseNumber(cols[5])
            });
          }
        }
      }
      setData(parsedData);
    } catch (err) {
      setMsg({ type: 'error', text: 'Lỗi kết nối máy chủ dữ liệu CSV.' });
    } finally {
      setLoading(LoadingState.IDLE);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Handlers ---
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // CHUẨN HÓA MST TÌM KIẾM: Xóa dấu gạch ngang để khớp với MST đã lưu
    const cleanKey = searchTerm.trim().replace(/['"\s-]/g, '');
    if (!cleanKey) return;

    setLoading(LoadingState.SEARCHING);
    setSearchResult(null);
    setAiInsight(null);
    setMsg({ type: '', text: '' });

    setTimeout(() => {
      const found = data.find(item => item.MST === cleanKey);
      if (found) {
        setSearchResult(found);
        setMsg({ type: 'success', text: `Tìm thấy dữ liệu cho MST: ${searchTerm}` });
      } else {
        setMsg({ type: 'error', text: `Không tìm thấy Mã số thuế: ${searchTerm}` });
      }
      setLoading(LoadingState.IDLE);
    }, 400);
  };

  const handleAiInsight = async () => {
    if (!searchResult) return;
    if (!process.env.API_KEY) {
      setShowConfigAlert(true);
      return;
    }
    setLoading(LoadingState.AI_ANALYZING);
    try {
      const insight = await getTaxInsights(searchResult);
      setAiInsight(insight);
    } catch (err) {
      setAiInsight("Lỗi hệ thống AI.");
    } finally {
      setLoading(LoadingState.IDLE);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('vi-VN');
  };

  // --- MÀN HÌNH ĐĂNG NHẬP ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>

        <div className="max-w-md w-full relative z-10">
          <div className="bg-white rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-10">
              <div className="flex flex-col items-center mb-10">
                <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-6 rotate-3">
                  <Lock size={40} className="text-white" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tighter">HĐĐT LOOKUP PRO</h1>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Internal Security Portal</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu truy cập</label>
                  <div className="relative group">
                    <KeyRound className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${loginError ? 'text-red-500' : 'text-slate-300 group-focus-within:text-blue-600'}`} size={20} />
                    <input
                      autoFocus
                      type="password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if(loginError) setLoginError(false);
                      }}
                      placeholder="••••••••••••"
                      className={`w-full pl-14 pr-6 py-5 bg-slate-50 border-2 rounded-2xl focus:outline-none transition-all text-xl font-mono tracking-widest ${loginError ? 'border-red-100 bg-red-50 text-red-600' : 'border-slate-100 focus:border-blue-600 focus:bg-white text-slate-800'}`}
                    />
                  </div>
                  {loginError && (
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 mt-2 animate-bounce">
                      <AlertCircle size={12} /> Mật khẩu không chính xác!
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                >
                  XÁC MINH DANH TÍNH
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
            
            <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
              <p className="text-slate-400 text-[9px] font-bold uppercase leading-relaxed px-4">
                Hệ thống ghi lại toàn bộ địa chỉ IP và lịch sử truy cập của cán bộ.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MÀN HÌNH CHÍNH (ĐÃ ĐĂNG NHẬP) ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased select-none font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-2xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase leading-none">HĐĐT <span className="text-blue-400">Lookup Pro</span></h1>
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Internal Cloud</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Global Stats Section */}
            <div className="hidden lg:flex items-center gap-6 bg-white/5 px-6 py-2 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg"><Building size={14} className="text-blue-400"/></div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">Doanh nghiệp</span>
                  <span className="text-xs font-bold font-mono">{formatNumber(globalStats.totalRecords)}</span>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-white/10"></div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg"><FileText size={14} className="text-emerald-400"/></div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">Tổng hóa đơn</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{formatNumber(globalStats.totalInvoices)}</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 rounded-xl transition-all border border-white/10 group flex items-center gap-2"
              title="Khóa phiên làm việc"
            >
              <LogOut size={18} />
              <span className="text-[10px] font-black uppercase hidden sm:inline">Khóa phiên</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-6xl w-full mx-auto px-6 py-10">
        {loading === LoadingState.FETCHING_DATA ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <Loader2 size={64} className="text-blue-600 animate-spin" />
              <Database size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Đang đồng bộ hóa dữ liệu trực tuyến...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Search Box */}
            <section className="bg-white rounded-[2.5rem] shadow-xl p-10 border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Search size={180} />
              </div>
              
              <div className="max-w-2xl mx-auto relative z-10 text-center">
                <h2 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight">Tra cứu hồ sơ thuế</h2>
                <p className="text-slate-400 text-xs mb-10 font-bold uppercase tracking-[0.2em]">Cơ quan thuế tỉnh Đắk Lắk</p>
                
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={24} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Nhập mã số thuế cần tra cứu..."
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-mono text-xl shadow-inner tracking-wider"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading === LoadingState.SEARCHING || !searchTerm.trim()}
                    className="w-full md:w-auto px-12 py-5 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto uppercase tracking-widest text-sm"
                  >
                    {loading === LoadingState.SEARCHING ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    Truy vấn dữ liệu
                  </button>
                </form>

                {msg.text && (
                   <div className={`mt-8 inline-flex px-6 py-3 rounded-xl text-[10px] font-black items-center gap-2 uppercase tracking-widest border ${msg.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                     {msg.type === 'error' ? <AlertCircle size={14}/> : <CheckCircle size={14}/>}
                     {msg.text}
                   </div>
                )}
              </div>
            </section>

            {/* Results Section */}
            {searchResult && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-bottom-8 duration-700">
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                             <div className="w-10 h-1 h-1 bg-blue-500 rounded-full"></div>
                             <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">Kết quả định danh</p>
                          </div>
                          <h3 className="text-4xl font-black leading-tight uppercase mb-6 tracking-tight">{searchResult.Ten}</h3>
                          <div className="flex flex-wrap gap-3">
                            <span className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold border border-white/10 flex items-center gap-2 shadow-inner">
                              <Hash size={14} className="text-blue-400"/> MST: <span className="font-mono">{searchResult.MST}</span>
                            </span>
                            <span className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold border border-white/10 flex items-center gap-2 shadow-inner">
                              <Building size={14} className="text-emerald-400"/> {searchResult.CQT}
                            </span>
                          </div>
                        </div>
                        <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 hidden sm:block backdrop-blur-md">
                           <ShieldCheck size={56} className="text-blue-500/50" />
                        </div>
                      </div>
                    </div>

                    <div className="p-10 grid grid-cols-1 sm:grid-cols-2 gap-8 bg-slate-50/30">
                      <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-blue-200 transition-all">
                        <div className="p-5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform"><FileText size={32}/></div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Số lượng hóa đơn</p>
                          <p className="text-3xl font-black text-slate-800 font-mono">{formatNumber(searchResult.SL)}</p>
                        </div>
                      </div>
                      
                      <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-rose-200 transition-all">
                        <div className="p-5 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform"><TrendingUp size={32}/></div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Thuế GTGT phát sinh</p>
                          <p className="text-3xl font-black text-slate-800 font-mono">{formatCurrency(searchResult.Thue)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-10 bg-blue-600 flex flex-col md:flex-row justify-between items-center gap-8 text-white">
                      <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl shadow-xl"><DollarSign size={40} /></div>
                        <div>
                          <p className="text-[10px] font-black uppercase opacity-70 tracking-widest mb-1">Tổng doanh thu lũy kế</p>
                          <p className="text-5xl font-black tracking-tighter">{formatCurrency(searchResult.TongTien)}</p>
                        </div>
                      </div>
                      <button className="px-8 py-4 bg-white text-blue-600 hover:bg-blue-50 rounded-2xl font-black flex items-center gap-3 transition-all shadow-2xl active:scale-95 uppercase text-xs tracking-widest">
                        <Download size={20} /> Xuất báo cáo
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Assistant Sidebar */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-slate-100 h-full flex flex-col">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-purple-100 text-purple-600 rounded-xl shadow-inner">
                        <BrainCircuit size={24} />
                      </div>
                      <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">AI Analytics</h4>
                    </div>
                    
                    {aiInsight ? (
                      <div className="flex-grow space-y-6 animate-in fade-in duration-500">
                        <div className="p-6 bg-slate-50 rounded-3xl border-l-4 border-purple-500 text-sm leading-relaxed text-slate-600 font-medium italic relative">
                           <span className="absolute -top-3 left-6 px-2 bg-white text-[9px] font-black text-purple-500 uppercase border border-purple-100 rounded-full">Nhận định AI</span>
                          "{aiInsight}"
                        </div>
                        <div className="p-4 bg-purple-50 rounded-2xl text-[9px] text-purple-700 font-black flex items-center gap-2 uppercase tracking-wide">
                          <Info size={14} /> Dữ liệu xử lý bởi mô hình Gen-AI 3.0
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 relative group">
                          <BrainCircuit size={40} className="text-slate-200 group-hover:text-purple-300 transition-colors" />
                          <div className="absolute inset-0 rounded-full bg-purple-500/5 animate-ping"></div>
                        </div>
                        <p className="text-xs text-slate-400 font-bold mb-8 leading-relaxed uppercase tracking-tighter">Phân tích sâu rủi ro &<br/>quy mô doanh nghiệp</p>
                        <button 
                          onClick={handleAiInsight}
                          disabled={loading === LoadingState.AI_ANALYZING}
                          className="w-full py-5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-xl shadow-purple-200 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase text-xs tracking-widest"
                        >
                          {loading === LoadingState.AI_ANALYZING ? <Loader2 className="animate-spin" size={20} /> : <TrendingUp size={20} />}
                          Kích hoạt AI
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-16 mt-20">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="text-center md:text-left">
            <p className="text-slate-900 font-black text-lg mb-2 tracking-tighter uppercase italic">HĐĐT Lookup Pro <span className="text-blue-600">v2.5</span></p>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Cổng thông tin nghiệp vụ nội bộ Đắk Lắk © 2025</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hỗ trợ kỹ thuật</p>
               <p className="text-xs font-bold text-slate-700">it.tax.daklak@mof.gov.vn</p>
            </div>
            <div className="h-10 w-[1px] bg-slate-100 hidden sm:block"></div>
            <div className="flex gap-4">
              <a href="#" className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Info size={24}/></a>
              <a href="#" className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><ExternalLink size={24}/></a>
            </div>
          </div>
        </div>
      </footer>

      {/* API Config Alert Modal */}
      {showConfigAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-slate-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
              <AlertCircle size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight uppercase">Lỗi cấu hình AI</h3>
            <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">
              Không tìm thấy <strong>API_KEY</strong> trên máy chủ. Vui lòng thiết lập biến môi trường để sử dụng tính năng phân tích thông minh.
            </p>
            <button 
              onClick={() => setShowConfigAlert(false)}
              className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
            >
              Tôi đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
