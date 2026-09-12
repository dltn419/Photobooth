// src/App.tsx
import { useState } from 'react';
import { Camera, Sparkles, Heart, Download, Timer, Image as ImageIcon } from 'lucide-react';
import { CameraView } from './CameraView';
import { EditView } from './EditView';
import { APP_TITLE, type FrameTemplate, type Photo } from './types';
import { bundledFrames, builtinFrames } from './frames';

type Phase = 'home' | 'camera' | 'edit';

function App() {
  const [phase, setPhase] = useState<Phase>('home');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<FrameTemplate>(
    bundledFrames.length > 0 ? bundledFrames[0] : builtinFrames[0]
  );
  const [timerSeconds, setTimerSeconds] = useState<number>(5);

  const startCamera = () => {
    setPhase('camera');
  };

  const handleCaptureComplete = (capturedPhotos: Photo[], frame: FrameTemplate) => {
    setPhotos(capturedPhotos);
    setSelectedFrame(frame);
    setPhase('edit');
  };

  const handleBackToCamera = () => {
    setPhotos([]);
    setPhase('camera');
  };

  const handleBackHome = () => {
    setPhotos([]);
    setPhase('home');
  };

  if (phase === 'camera') {
    return (
      <CameraView
        initialFrame={selectedFrame}
        timerSeconds={timerSeconds}
        onComplete={handleCaptureComplete}
        onCancel={handleBackHome}
      />
    );
  }

  if (phase === 'edit') {
    return (
      <EditView
        photos={photos}
        initialFrame={selectedFrame}
        onBack={handleBackToCamera}
      />
    );
  }

  const framesList = bundledFrames.length > 0 ? bundledFrames : builtinFrames;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-72 h-72 bg-brand-200 rounded-full opacity-30 blur-3xl -translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-300 rounded-full opacity-20 blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full text-center">
        {/* 타이틀 헤더 */}
        <div className="flex flex-col items-center gap-2 animate-fadeIn">
          <div className="relative">
            <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center shadow-xl rotate-3">
              <Camera size={32} className="text-white" />
            </div>
            <Sparkles size={20} className="absolute -top-2 -right-2 text-brand-400 animate-pop" />
          </div>
          <h1 className="font-display text-4xl text-brand-600 mt-2">{APP_TITLE}</h1>
          <p className="font-body text-gray-500 text-sm">지금 이 순간을 네 컷에 담아보세요</p>
        </div>

        {/* 1. 프레임 선택 카드 */}
        <div className="w-full bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-brand-100 shadow-sm flex flex-col items-start gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <ImageIcon size={16} className="text-brand-500" />
            <span>프레임 선택</span>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full">
            {framesList.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFrame(f)}
                className={`relative aspect-[1181/1748] rounded-lg overflow-hidden border-2 transition-all ${
                  selectedFrame.id === f.id
                    ? 'border-brand-500 ring-2 ring-brand-300 scale-105 shadow-md'
                    : 'border-gray-200 hover:border-brand-300 opacity-70'
                }`}
              >
                {f.overlayUrl ? (
                  <img src={f.overlayUrl} alt={f.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ backgroundColor: f.bgColor }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2. 카운트다운 타이머 선택 카드 */}
        <div className="w-full bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-brand-100 shadow-sm flex flex-col items-start gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Timer size={16} className="text-brand-500" />
            <span>촬영 카운트다운 선택</span>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full">
            {[5, 8, 10].map((sec) => (
              <button
                key={sec}
                onClick={() => setTimerSeconds(sec)}
                className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  timerSeconds === sec
                    ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {sec}초
              </button>
            ))}
          </div>
        </div>

        {/* 안내 아이콘 카드 */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          <FeatureCard icon={<Camera size={18} />} title="칸 확대 촬영" desc="찍는 칸이 화면을 채움" />
          <FeatureCard icon={<Heart size={18} />} title="칸마다 2장" desc="8컷 중 4컷 선택" />
          <FeatureCard icon={<Sparkles size={18} />} title="프레임 지원" desc="다양한 디자인 지원" />
          <FeatureCard icon={<Download size={18} />} title="고화질 저장" desc="JPG 다운로드" />
        </div>

        {/* 시작하기 버튼 */}
        <button
          onClick={startCamera}
          className="w-full flex items-center justify-center gap-2 py-4 bg-brand-500 text-white rounded-2xl font-display text-xl shadow-xl hover:bg-brand-600 active:scale-95 transition-all"
        >
          <Camera size={24} />
          촬영 시작하기
        </button>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-start gap-1 p-3 bg-white/70 backdrop-blur-sm rounded-xl border border-brand-100 shadow-sm">
      <div className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center text-brand-500">
        {icon}
      </div>
      <h3 className="font-display text-xs text-gray-800">{title}</h3>
      <p className="text-[10px] text-gray-400 font-body">{desc}</p>
    </div>
  );
}

export default App;
