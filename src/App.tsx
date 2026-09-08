import { useState } from 'react';
import { Camera, Sparkles, Heart, Download } from 'lucide-react';
import { CameraView } from './CameraView';
import { EditView } from './EditView';
import { APP_TITLE, type FrameTemplate, type Photo } from './types';

type Phase = 'home' | 'camera' | 'edit';

function App() {
  const [phase, setPhase] = useState<Phase>('home');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [frame, setFrame] = useState<FrameTemplate | null>(null);

  const startCamera = () => {
    setPhase('camera');
  };

  const handleCaptureComplete = (captured: Photo[], selectedFrame: FrameTemplate) => {
    setPhotos(captured);
    setFrame(selectedFrame);
    setPhase('edit');
  };

  const handleBackToCamera = () => {
    setPhotos([]);
    setFrame(null);
    setPhase('camera');
  };

  const handleBackHome = () => {
    setPhotos([]);
    setFrame(null);
    setPhase('home');
  };

  if (phase === 'camera') {
    return <CameraView onComplete={handleCaptureComplete} onCancel={handleBackHome} />;
  }

  if (phase === 'edit' && frame) {
    return <EditView photos={photos} initialFrame={frame} onBack={handleBackToCamera} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-72 h-72 bg-brand-200 rounded-full opacity-30 blur-3xl -translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-300 rounded-full opacity-20 blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md text-center">
        <div className="flex flex-col items-center gap-3 animate-fadeIn">
          <div className="relative">
            <div className="w-20 h-20 bg-brand-500 rounded-2xl flex items-center justify-center shadow-xl rotate-3">
              <Camera size={40} className="text-white" />
            </div>
            <Sparkles size={24} className="absolute -top-2 -right-2 text-brand-400 animate-pop" />
          </div>
          <h1 className="font-display text-5xl text-brand-600 mt-2">{APP_TITLE}</h1>
          <p className="font-body text-gray-500 text-lg">지금 이 순간을 네 컷에 담아보세요</p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full animate-scaleIn">
          <FeatureCard icon={<Camera size={20} />} title="칸 확대 촬영" desc="찍는 칸이 화면을 채움" />
          <FeatureCard icon={<Heart size={20} />} title="칸마다 2장" desc="8컷 중 4컷 선택" />
          <FeatureCard icon={<Sparkles size={20} />} title="프레임 파일" desc="public/frames에 PNG" />
          <FeatureCard icon={<Download size={20} />} title="고화질 저장" desc="JPG 다운로드" />
        </div>

        <button
          onClick={startCamera}
          className="flex items-center justify-center gap-3 px-10 py-4 bg-brand-500 text-white rounded-2xl font-display text-2xl shadow-xl hover:bg-brand-600 active:scale-95 transition-all animate-slideUp"
        >
          <Camera size={28} />
          시작하기
        </button>

        <p className="text-xs text-gray-400 font-body">
          PC 웹캠 및 스마트폰 카메라 모두 지원됩니다
        </p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-brand-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center text-brand-500">
        {icon}
      </div>
      <h3 className="font-display text-sm text-gray-800">{title}</h3>
      <p className="text-xs text-gray-400 font-body">{desc}</p>
    </div>
  );
}

export default App;
