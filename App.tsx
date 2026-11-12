import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Loader2, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Layers, 
  LayoutTemplate, 
  FileText, 
  Upload, 
  Check, 
  AlertCircle, 
  Cpu, 
  Cloud, 
  HardDrive, 
  Terminal, 
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';
import FileUpload from './components/FileUpload';
import { 
  parseCourseStructure, 
  generateTeachingPlan, 
  curateLessonsWithAI, 
  analyzeTemplateFile,
  checkOllamaStatus
} from './services/documentService';
import { 
  CourseLesson, 
  ProcessingStatus, 
  TeachingPlanTemplate, 
  CustomTemplateAnalysis, 
  AIProvider, 
  OllamaConfig 
} from './types';
import { 
  SAMPLE_STRUCTURES, 
  PRESET_TEMPLATES, 
  OLLAMA_MODELS 
} from './data/sampleStructures';

function App() {
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', message: '' });
  const [activeTab, setActiveTab] = useState<'ai-curated' | 'table'>('ai-curated');
  const [expandedLessonId, setExpandedLessonId] = useState<number | null>(null);

  // Structure selection state
  const [selectedStructureId, setSelectedStructureId] = useState<string>('custom-upload');
  const [structureSourceTitle, setStructureSourceTitle] = useState<string>('Chưa chọn cấu trúc');

  // Template selection state
  const [templates, setTemplates] = useState<TeachingPlanTemplate[]>(PRESET_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('mau-f-standard');
  const [customTemplateAnalysis, setCustomTemplateAnalysis] = useState<CustomTemplateAnalysis | null>(null);
  const [customTemplateFileName, setCustomTemplateFileName] = useState<string | null>(null);

  // AI Provider & Ollama State
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>({
    host: 'http://localhost:11434',
    model: 'gemma4:e4b',
    customModelName: '',
  });
  const [showCustomOllamaModelInput, setShowCustomOllamaModelInput] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{
    checked: boolean;
    online: boolean;
    models?: string[];
    error?: string;
  }>({ checked: false, online: false });
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [showOllamaHelp, setShowOllamaHelp] = useState(false);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];
  const activeOllamaModelName = showCustomOllamaModelInput 
    ? (ollamaConfig.customModelName || 'Custom Model')
    : (OLLAMA_MODELS.find(m => m.tag === ollamaConfig.model)?.name || ollamaConfig.model);

  // Check Ollama connection on demand
  const handleTestOllama = async () => {
    setIsCheckingOllama(true);
    try {
      const res = await checkOllamaStatus(ollamaConfig.host);
      setOllamaStatus({
        checked: true,
        online: res.online,
        models: res.models,
        error: res.error,
      });
    } catch (e: any) {
      setOllamaStatus({
        checked: true,
        online: false,
        error: e.message || 'Không thể kết nối tới Ollama',
      });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  // 1. Handle Course Structure File Upload (ANY Word document)
  const handleFileSelect = async (selectedFile: File) => {
    setSelectedStructureId('custom-upload');
    setStructureSourceTitle(selectedFile.name);
    
    const engineLabel = aiProvider === 'ollama' ? `Ollama (${activeOllamaModelName})` : 'Cloud AI (Gemini 3.8 Flash)';
    setStatus({ step: 'parsing', message: `Đang đọc cấu trúc học phần (${engineLabel})...` });
    
    try {
      const parsedLessons = await parseCourseStructure(selectedFile, aiProvider, ollamaConfig);
      
      if (parsedLessons.length === 0) {
        setStatus({ 
          step: 'error', 
          message: 'Không tìm thấy bảng hoặc dữ liệu bài học hợp lệ trong tài liệu. Vui lòng kiểm tra lại file.' 
        });
        return;
      }

      setStatus({ 
        step: 'curating', 
        message: `${engineLabel} đang chọn lọc nội dung cho Thảo luận, Tự học có HD và Tự học...` 
      });

      const curatedLessons = await curateLessonsWithAI(parsedLessons, aiProvider, ollamaConfig);
      setLessons(curatedLessons);
      if (curatedLessons.length > 0) {
        setExpandedLessonId(curatedLessons[0].id);
      }
      
      setStatus({ 
        step: 'idle', 
        message: `Đã xử lý xong ${curatedLessons.length} bài học bằng ${engineLabel}! Nội dung đã được chọn lọc phù hợp số tiết.` 
      });
    } catch (e: any) {
      console.error(e);
      setStatus({ 
        step: 'error', 
        message: e.message || 'Lỗi khi phân tích cấu trúc học phần. Nếu dùng Ollama, hãy đảm bảo Ollama đang chạy.' 
      });
    }
  };

  // 2. Handle Choosing a Sample Course Structure
  const handleSelectSampleStructure = async (sampleId: string) => {
    const sample = SAMPLE_STRUCTURES.find(s => s.id === sampleId);
    if (!sample) return;

    setSelectedStructureId(sample.id);
    setStructureSourceTitle(`${sample.name} (${sample.credits} tín chỉ)`);
    
    const engineLabel = aiProvider === 'ollama' ? `Ollama (${activeOllamaModelName})` : 'Cloud Gemini';
    setStatus({ step: 'curating', message: `Đang tải học phần và chạy ${engineLabel} chọn lọc nội dung...` });

    try {
      const curatedLessons = await curateLessonsWithAI(sample.lessons, aiProvider, ollamaConfig);
      setLessons(curatedLessons);
      if (curatedLessons.length > 0) {
        setExpandedLessonId(curatedLessons[0].id);
      }
      setStatus({ 
        step: 'idle', 
        message: `Đã chọn cấu trúc: ${sample.name} (${curatedLessons.length} bài, xử lý bởi ${engineLabel}).` 
      });
    } catch (err) {
      setLessons(sample.lessons);
      setStatus({ step: 'idle', message: `Đã chọn cấu trúc: ${sample.name}.` });
    }
  };

  // 3. Handle Custom Template File Upload (ANY Word template document)
  const handleCustomTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    setCustomTemplateFileName(file.name);
    const engineLabel = aiProvider === 'ollama' ? `Ollama (${activeOllamaModelName})` : 'AI';
    setStatus({ 
      step: 'analyzing-template', 
      message: `${engineLabel} đang phân tích cấu trúc bảng mẫu kế hoạch dạy học...` 
    });

    try {
      const analysis = await analyzeTemplateFile(file, aiProvider, ollamaConfig);
      setCustomTemplateAnalysis(analysis);

      setTemplates(prev => prev.map(t => {
        if (t.id === 'mau-custom') {
          return {
            ...t,
            name: `Mẫu tải lên: ${analysis.title || file.name}`,
            analysis: analysis,
          };
        }
        return t;
      }));
      setSelectedTemplateId('mau-custom');

      setStatus({ 
        step: 'idle', 
        message: `${engineLabel} đã nhận diện thành công mẫu: "${analysis.title || file.name}" (${analysis.columns.length} cột)!` 
      });
    } catch (err: any) {
      console.error(err);
      setStatus({ 
        step: 'error', 
        message: err.message || 'Lỗi khi AI phân tích file mẫu. Vui lòng kiểm tra lại file Word.' 
      });
    }
  };

  // 4. Handle Re-curating with AI
  const handleReCurateAI = async () => {
    if (lessons.length === 0) return;
    const engineLabel = aiProvider === 'ollama' ? `Ollama (${activeOllamaModelName})` : 'Cloud Gemini';
    setStatus({ 
      step: 'curating', 
      message: `${engineLabel} đang chọn lọc lại nội dung thảo luận và tự học theo cấu trúc số tiết...` 
    });
    try {
      const reCurated = await curateLessonsWithAI(lessons, aiProvider, ollamaConfig);
      setLessons(reCurated);
      setStatus({ 
        step: 'idle', 
        message: `Đã hoàn tất chọn lọc lại nội dung bằng ${engineLabel}!` 
      });
    } catch (e: any) {
      console.error(e);
      setStatus({ 
        step: 'error', 
        message: e.message || 'Lỗi khi chọn lọc lại nội dung bằng AI.' 
      });
    }
  };

  // 5. Generate and Download Teaching Plan according to Selected Template
  const handleGenerate = async () => {
    if (lessons.length === 0) return;

    setStatus({ 
      step: 'generating', 
      message: `Đang tạo kế hoạch phương pháp dạy học theo "${selectedTemplate.name}"...` 
    });

    try {
      await generateTeachingPlan(lessons, selectedTemplate);
      setStatus({ step: 'completed', message: 'Tải xuống tài liệu Word thành công!' });
      
      setTimeout(() => {
        setStatus({ step: 'idle', message: '' });
      }, 3500);
    } catch (e: any) {
      console.error(e);
      setStatus({ step: 'error', message: e.message || 'Không thể tạo tài liệu Word.' });
    }
  };

  // Helpers to update curated topics directly
  const handleUpdateTopic = (
    lessonId: number, 
    type: 'discussionTopics' | 'guidedStudyTopics' | 'selfStudyTopics', 
    index: number, 
    val: string
  ) => {
    setLessons(prev => prev.map(l => {
      if (l.id !== lessonId) return l;
      const list = [...(l[type] || [])];
      list[index] = val;
      return { ...l, [type]: list };
    }));
  };

  const handleAddTopic = (
    lessonId: number, 
    type: 'discussionTopics' | 'guidedStudyTopics' | 'selfStudyTopics'
  ) => {
    setLessons(prev => prev.map(l => {
      if (l.id !== lessonId) return l;
      const list = [...(l[type] || []), 'Nội dung mới'];
      return { ...l, [type]: list };
    }));
  };

  const handleRemoveTopic = (
    lessonId: number, 
    type: 'discussionTopics' | 'guidedStudyTopics' | 'selfStudyTopics', 
    index: number
  ) => {
    setLessons(prev => prev.map(l => {
      if (l.id !== lessonId) return l;
      const list = (l[type] || []).filter((_, i) => i !== index);
      return { ...l, [type]: list };
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 mb-3">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Teaching Plan Studio
          </h1>
          <p className="text-slate-600 max-w-3xl mx-auto text-sm sm:text-base leading-relaxed">
            Tự động tạo <strong>Kế hoạch & Phương pháp dạy học</strong> từ <strong>Cấu trúc bất kỳ</strong> sang <strong>Mẫu bất kỳ</strong>.
            Hỗ trợ chạy với <strong>Cloud Gemini</strong> hoặc <strong>Ollama cục bộ</strong> (Gemma 4, Qwen 3.6, Qwen 2.5 Coder).
          </p>
        </div>

        {/* AI ENGINE & OLLAMA CONFIGURATION BAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Engine Switcher */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Cpu size={16} className="text-blue-600" />
                Động cơ AI:
              </span>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setAiProvider('gemini')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    aiProvider === 'gemini'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Cloud size={14} className={aiProvider === 'gemini' ? 'text-blue-600' : 'text-slate-400'} />
                  Cloud Gemini 3.8 Flash
                </button>
                <button
                  onClick={() => setAiProvider('ollama')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    aiProvider === 'ollama'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <HardDrive size={14} className={aiProvider === 'ollama' ? 'text-indigo-200' : 'text-slate-400'} />
                  Ollama Cục bộ (Local)
                </button>
              </div>
            </div>

            {/* Ollama Status / Quick Info */}
            {aiProvider === 'ollama' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestOllama}
                  disabled={isCheckingOllama}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {isCheckingOllama ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                  Kiểm tra Ollama
                </button>
                {ollamaStatus.checked && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    ollamaStatus.online 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {ollamaStatus.online ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Ollama Online ({ollamaStatus.models?.length || 0} models)
                      </>
                    ) : (
                      <>
                        <WifiOff size={11} />
                        Chưa kết nối
                      </>
                    )}
                  </span>
                )}
                <button
                  onClick={() => setShowOllamaHelp(!showOllamaHelp)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  {showOllamaHelp ? 'Ẩn hướng dẫn' : 'Hướng dẫn chạy'}
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Cloud API sẵn sàng (Tốc độ cao, không cần GPU)</span>
              </div>
            )}
          </div>

          {/* Expanded Ollama Model & Host Selection */}
          {aiProvider === 'ollama' && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  Chọn model Ollama trên máy tính:
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Host URL:</span>
                  <input
                    type="text"
                    value={ollamaConfig.host}
                    onChange={(e) => setOllamaConfig(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="http://localhost:11434"
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 font-mono"
                  />
                </div>
              </div>

              {/* Ollama Models Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {OLLAMA_MODELS.map(m => {
                  const isSelected = !showCustomOllamaModelInput && ollamaConfig.model === m.tag;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setShowCustomOllamaModelInput(false);
                        setOllamaConfig(prev => ({ ...prev, model: m.tag }));
                      }}
                      className={`text-left p-3 rounded-xl border text-xs transition-all relative ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-slate-900 font-bold">{m.name}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-mono">
                          {m.tag}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] line-clamp-2">
                        {m.description}
                      </p>
                      {isSelected && (
                        <div className="absolute top-2 right-2 text-indigo-600">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Model Toggle & Input */}
              <div className="flex items-center gap-3 pt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={showCustomOllamaModelInput}
                    onChange={(e) => setShowCustomOllamaModelInput(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Sử dụng model Ollama tùy biến khác</span>
                </label>
                {showCustomOllamaModelInput && (
                  <input
                    type="text"
                    value={ollamaConfig.customModelName || ''}
                    onChange={(e) => setOllamaConfig(prev => ({ ...prev, customModelName: e.target.value }))}
                    placeholder="Ví dụ: mistral, deepseek-r1:8b, llama3.3:70b..."
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono flex-1 max-w-sm"
                  />
                )}
              </div>

              {/* Ollama Setup Instructions Banner */}
              {showOllamaHelp && (
                <div className="p-3.5 bg-slate-900 text-slate-200 rounded-xl text-xs space-y-2 mt-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <Terminal size={14} />
                    <span>Lệnh khởi chạy Ollama cục bộ trên máy:</span>
                  </div>
                  <div className="font-mono text-[11px] bg-black/40 p-2.5 rounded-lg space-y-1 text-emerald-300 select-all">
                    <p># 1. Khởi động Ollama (cho phép CORS từ trình duyệt):</p>
                    <p className="text-white">OLLAMA_ORIGINS="*" ollama serve</p>
                    <p className="mt-2"># 2. Tải các model cần dùng (chạy trong cửa sổ terminal khác):</p>
                    <p className="text-white">ollama pull gemma4:e4b</p>
                    <p className="text-white">ollama pull qwen3.6:35b-a3b-q4</p>
                    <p className="text-white">ollama pull gemma4:12b</p>
                    <p className="text-white">ollama pull qwen2.5-coder:7b</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Status Banner */}
        {status.message && (
          <div className={`p-4 rounded-xl text-center text-sm font-medium transition-all shadow-sm ${
            status.step === 'error' 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : status.step === 'curating' || status.step === 'parsing' || status.step === 'analyzing-template' || status.step === 'generating'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              {status.step === 'parsing' || status.step === 'curating' || status.step === 'analyzing-template' || status.step === 'generating' ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={18} />
                  {status.message}
                </span>
              ) : status.step === 'completed' ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-600" size={18} />
                  {status.message}
                </span>
              ) : (
                <span>{status.message}</span>
              )}

              {/* Fallback button if Ollama failed */}
              {status.step === 'error' && aiProvider === 'ollama' && (
                <button
                  onClick={() => {
                    setAiProvider('gemini');
                    setStatus({ step: 'idle', message: 'Đã chuyển sang Cloud Gemini AI. Bạn có thể bấm chọn hoặc chạy lại!' });
                  }}
                  className="mt-2 sm:mt-0 sm:ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Chuyển sang Cloud Gemini AI ngay
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2 MAIN SELECTION CARDS: STEP 1 & STEP 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* STEP 1: CHỌN CẤU TRÚC HỌC PHẦN BẤT KỲ */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-base font-bold text-slate-800">
                    Cấu trúc học phần (Bất kỳ)
                  </h2>
                </div>
                {lessons.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Check size={12} /> {lessons.length} bài học
                  </span>
                )}
              </div>

              {/* Upload area for ANY course structure file */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tải lên file Word Cấu trúc học phần bất kỳ (.docx):
                </label>
                <FileUpload 
                  onFileSelect={handleFileSelect} 
                  isProcessing={status.step === 'parsing' || status.step === 'curating' || status.step === 'generating'} 
                />
              </div>

              {/* Or Select Preset Structures */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Hoặc chọn nhanh cấu trúc có sẵn:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SAMPLE_STRUCTURES.map(sample => (
                    <button
                      key={sample.id}
                      onClick={() => handleSelectSampleStructure(sample.id)}
                      className={`text-left p-3 rounded-xl border text-xs transition-all ${
                        selectedStructureId === sample.id
                          ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="font-bold text-slate-900 mb-0.5">{sample.name}</div>
                      <div className="text-slate-500 text-[11px] mb-1.5">{sample.code} • {sample.credits} tín chỉ</div>
                      <div className="text-slate-600 text-[11px] line-clamp-1">{sample.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Current Selected Structure Info */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Đang chọn: <strong className="text-slate-800">{structureSourceTitle}</strong></span>
              {lessons.length > 0 && (
                <span className="text-blue-600 font-semibold">{lessons.length} bài ({lessons.reduce((a, b) => a + b.totalPeriods, 0)} tiết)</span>
              )}
            </div>
          </div>

          {/* STEP 2: CHỌN MẪU KẾ HOẠCH PHƯƠNG PHÁP DẠY HỌC BẤT KỲ */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-base font-bold text-slate-800">
                    Mẫu Kế hoạch & PP Dạy học (Bất kỳ)
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                  {selectedTemplate.badge}
                </span>
              </div>

              <div className="space-y-2.5 mb-4">
                {templates.map(tpl => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 mb-0.5 flex items-center gap-1.5">
                            {tpl.name}
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-600 font-medium">
                              {tpl.badge}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            {tpl.description}
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="template_select"
                          checked={isSelected}
                          onChange={() => setSelectedTemplateId(tpl.id)}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>

                      {/* Custom Upload Form for 'mau-custom' */}
                      {tpl.isCustomUpload && isSelected && (
                        <div className="mt-3 pt-3 border-t border-indigo-200/60" onClick={e => e.stopPropagation()}>
                          <label className="block text-[11px] font-semibold text-indigo-900 mb-1.5">
                            Tải lên file Word (.docx) mẫu kế hoạch dạy học của bạn:
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium cursor-pointer text-xs transition-colors shadow-sm">
                              <Upload size={14} />
                              {customTemplateFileName ? 'Đổi file mẫu' : 'Chọn file Word mẫu'}
                              <input
                                type="file"
                                accept=".docx"
                                className="hidden"
                                onChange={handleCustomTemplateUpload}
                              />
                            </label>
                            {customTemplateFileName && (
                              <span className="text-slate-600 text-xs truncate max-w-xs font-medium">
                                {customTemplateFileName}
                              </span>
                            )}
                          </div>

                          {/* Analyzed Template Details */}
                          {customTemplateAnalysis && (
                            <div className="mt-2.5 p-2.5 bg-white border border-indigo-200 rounded-lg text-[11px] text-slate-700 space-y-1">
                              <div><strong>Tiêu đề nhận diện:</strong> {customTemplateAnalysis.title}</div>
                              <div><strong>Các cột nhận diện ({customTemplateAnalysis.columns.length}):</strong> {customTemplateAnalysis.columns.map(c => c.header).join(' | ')}</div>
                              <div><strong>Bố cục hoạt động:</strong> {customTemplateAnalysis.activityStyle}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Mẫu đang áp dụng: <strong className="text-indigo-700">{selectedTemplate.name}</strong></span>
            </div>
          </div>
        </div>

        {/* STEP 3: PREVIEW DATA & GENERATE BUTTON */}
        {lessons.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
            
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('ai-curated')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'ai-curated'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sparkles size={16} className={activeTab === 'ai-curated' ? 'text-amber-300' : 'text-slate-500'} />
                  Nội dung AI chọn lọc ({lessons.length} bài)
                </button>
                <button
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'table'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Layers size={16} />
                  Bảng tổng hợp tiết học
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleReCurateAI}
                  disabled={status.step === 'curating' || status.step === 'generating'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                  title="Chạy lại AI để chọn lọc lại nội dung thảo luận và tự học"
                >
                  <RefreshCw size={14} className={status.step === 'curating' ? 'animate-spin' : ''} />
                  Chọn lọc lại ({aiProvider === 'ollama' ? 'Ollama' : 'Cloud'})
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={status.step === 'generating' || status.step === 'curating'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-md shadow-green-600/20 transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 text-sm"
                >
                  {status.step === 'generating' ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  Tạo kế hoạch dạy học (Word)
                </button>
              </div>
            </div>

            {/* Template Info Alert Banner */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
              <LayoutTemplate className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">
                  AI sẽ xuất file Word theo: <span className="underline">{selectedTemplate.name}</span>
                </p>
                <p className="text-indigo-800 text-xs">
                  Động cơ AI đang hoạt động: <strong>{aiProvider === 'ollama' ? `Ollama cục bộ (${activeOllamaModelName})` : 'Cloud Gemini 3.8 Flash'}</strong>.
                  Nội dung Thảo luận, Tự học có HD và Tự học đã được chắt lọc chuẩn xác theo số tiết phân bổ.
                </p>
              </div>
            </div>

            {/* TAB 1: AI CURATED TOPICS (DETAILED BY LESSON) */}
            {activeTab === 'ai-curated' && (
              <div className="space-y-3">
                {lessons.map((lesson) => {
                  const isExpanded = expandedLessonId === lesson.id;
                  const hasDiscussion = lesson.discussionPeriods > 0;
                  const hasGuided = lesson.guidedStudyPeriods > 0;
                  const hasSelf = lesson.selfStudyPeriods > 0;

                  return (
                    <div 
                      key={lesson.id} 
                      className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden transition-all"
                    >
                      {/* Lesson Summary Header */}
                      <div 
                        onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                        className="p-4 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            #{lesson.id}
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{lesson.content}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span className="px-2 py-0.5 text-[11px] rounded bg-slate-200 text-slate-700 font-medium">
                                Tổng: {lesson.totalPeriods} tiết
                              </span>
                              {lesson.theoryPeriods > 0 && (
                                <span className="px-2 py-0.5 text-[11px] rounded bg-blue-100 text-blue-700 font-medium">
                                  LT: {lesson.theoryPeriods} tiết
                                </span>
                              )}
                              {hasDiscussion && (
                                <span className="px-2 py-0.5 text-[11px] rounded bg-purple-100 text-purple-700 font-medium">
                                  Thảo luận: {lesson.discussionPeriods} tiết ({lesson.discussionTopics?.length || 0} mục)
                                </span>
                              )}
                              {lesson.exercisePeriods > 0 && (
                                <span className="px-2 py-0.5 text-[11px] rounded bg-amber-100 text-amber-700 font-medium">
                                  Bài tập: {lesson.exercisePeriods} tiết
                                </span>
                              )}
                              {hasGuided && (
                                <span className="px-2 py-0.5 text-[11px] rounded bg-indigo-100 text-indigo-700 font-medium">
                                  Tự học HD: {lesson.guidedStudyPeriods} tiết ({lesson.guidedStudyTopics?.length || 0} mục)
                                </span>
                              )}
                              {hasSelf && (
                                <span className="px-2 py-0.5 text-[11px] rounded bg-emerald-100 text-emerald-700 font-medium">
                                  Tự học: {lesson.selfStudyPeriods} tiết ({lesson.selfStudyTopics?.length || 0} mục)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto text-slate-400">
                          <span className="text-xs text-slate-500 hidden sm:inline">
                            {isExpanded ? 'Thu gọn' : 'Xem & Chỉnh sửa'}
                          </span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Expanded Curated Details */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 border-t border-slate-200 space-y-5 bg-white">
                          
                          {/* 1. THẢO LUẬN */}
                          {hasDiscussion ? (
                            <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                                  <h4 className="text-xs sm:text-sm font-bold text-purple-900 uppercase tracking-wide">
                                    Nội dung Thảo luận ({lesson.discussionPeriods} tiết)
                                  </h4>
                                </div>
                                <button
                                  onClick={() => handleAddTopic(lesson.id, 'discussionTopics')}
                                  className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium"
                                >
                                  <Plus size={14} /> Thêm mục
                                </button>
                              </div>
                              <p className="text-xs text-purple-700 mb-3">
                                * AI đã chọn lọc {lesson.discussionTopics?.length || 0} nội dung thảo luận trọng tâm tương xứng với {lesson.discussionPeriods} tiết (không đưa nguyên toàn bộ bài học).
                              </p>

                              <div className="space-y-2">
                                {(lesson.discussionTopics || []).map((topic, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-purple-600 w-5 text-right">{idx + 1}.</span>
                                    <input
                                      type="text"
                                      value={topic}
                                      onChange={(e) => handleUpdateTopic(lesson.id, 'discussionTopics', idx, e.target.value)}
                                      className="flex-1 text-xs sm:text-sm px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                    <button
                                      onClick={() => handleRemoveTopic(lesson.id, 'discussionTopics', idx)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                                      title="Xoá mục này"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">
                              Bài này không có tiết Thảo luận (0 tiết).
                            </div>
                          )}

                          {/* 2. TỰ HỌC CÓ HƯỚNG DẪN */}
                          {hasGuided ? (
                            <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                  <h4 className="text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wide">
                                    Nội dung Tự học có hướng dẫn (HD: {lesson.guidedStudyPeriods} tiết)
                                  </h4>
                                </div>
                                <button
                                  onClick={() => handleAddTopic(lesson.id, 'guidedStudyTopics')}
                                  className="flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900 font-medium"
                                >
                                  <Plus size={14} /> Thêm mục
                                </button>
                              </div>
                              <p className="text-xs text-indigo-700 mb-3">
                                * AI đã chọn lọc các phần giảng viên cần hướng dẫn học viên ôn tập, làm bài tập tương xứng với {lesson.guidedStudyPeriods} tiết HD.
                              </p>

                              <div className="space-y-2">
                                {(lesson.guidedStudyTopics || []).map((topic, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-indigo-600 w-5 text-right">{idx + 1}.</span>
                                    <input
                                      type="text"
                                      value={topic}
                                      onChange={(e) => handleUpdateTopic(lesson.id, 'guidedStudyTopics', idx, e.target.value)}
                                      className="flex-1 text-xs sm:text-sm px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                    <button
                                      onClick={() => handleRemoveTopic(lesson.id, 'guidedStudyTopics', idx)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                                      title="Xoá mục này"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* 3. TỰ HỌC */}
                          {hasSelf ? (
                            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                                  <h4 className="text-xs sm:text-sm font-bold text-emerald-900 uppercase tracking-wide">
                                    Nội dung Tự học ({lesson.selfStudyPeriods} tiết)
                                  </h4>
                                </div>
                                <button
                                  onClick={() => handleAddTopic(lesson.id, 'selfStudyTopics')}
                                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium"
                                >
                                  <Plus size={14} /> Thêm mục
                                </button>
                              </div>
                              <p className="text-xs text-emerald-700 mb-3">
                                * AI đã chọn lọc các nội dung tự đọc giáo trình và tra cứu độc lập tương xứng với {lesson.selfStudyPeriods} tiết tự học.
                              </p>

                              <div className="space-y-2">
                                {(lesson.selfStudyTopics || []).map((topic, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-emerald-600 w-5 text-right">{idx + 1}.</span>
                                    <input
                                      type="text"
                                      value={topic}
                                      onChange={(e) => handleUpdateTopic(lesson.id, 'selfStudyTopics', idx, e.target.value)}
                                      className="flex-1 text-xs sm:text-sm px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                    />
                                    <button
                                      onClick={() => handleRemoveTopic(lesson.id, 'selfStudyTopics', idx)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                                      title="Xoá mục này"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Reference to original topics */}
                          <div className="pt-2 border-t border-slate-100">
                            <details className="text-xs text-slate-500">
                              <summary className="cursor-pointer font-medium hover:text-slate-700 select-none">
                                Xem toàn bộ nội dung lý thuyết gốc của bài ({lesson.topics.length} mục)
                              </summary>
                              <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-1">
                                {lesson.topics.map((t, i) => (
                                  <p key={i} className="text-slate-600">{t}</p>
                                ))}
                              </div>
                            </details>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: RAW TABLE PREVIEW */}
            {activeTab === 'table' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-medium text-slate-700 flex justify-between items-center text-sm">
                  <span>Dữ liệu phân bổ số tiết ({lessons.length} bài)</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase tracking-wider">Bài học</th>
                        <th className="px-3 py-3 text-center font-medium text-slate-500 uppercase tracking-wider">Tổng</th>
                        <th className="px-3 py-3 text-center font-medium text-slate-500 uppercase tracking-wider">LT</th>
                        <th className="px-3 py-3 text-center font-medium text-slate-500 uppercase tracking-wider">TL</th>
                        <th className="px-3 py-3 text-center font-medium text-slate-500 uppercase tracking-wider">BT</th>
                        <th className="px-3 py-3 text-center font-medium text-slate-500 uppercase tracking-wider">Tự học HD</th>
                        <th className="px-3 py-3 text-center font-medium text-slate-500 uppercase tracking-wider">Tự học</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {lessons.map((lesson) => (
                        <tr key={lesson.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-900 font-medium max-w-xs truncate">{lesson.content}</td>
                          <td className="px-3 py-3 text-center text-slate-600">{lesson.totalPeriods}</td>
                          <td className="px-3 py-3 text-center text-slate-600">{lesson.theoryPeriods}</td>
                          <td className="px-3 py-3 text-center text-slate-600 font-semibold text-purple-600">{lesson.discussionPeriods}</td>
                          <td className="px-3 py-3 text-center text-slate-600">{lesson.exercisePeriods}</td>
                          <td className="px-3 py-3 text-center text-slate-600 font-semibold text-indigo-600">{lesson.guidedStudyPeriods}</td>
                          <td className="px-3 py-3 text-center text-slate-600 font-semibold text-emerald-600">{lesson.selfStudyPeriods}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bottom Generate Button */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={status.step === 'generating' || status.step === 'curating'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow-lg shadow-green-600/20 transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
              >
                {status.step === 'generating' ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Download size={20} />
                )}
                Tạo kế hoạch dạy học ({selectedTemplate.name})
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;