import { useState } from 'react';
import './animations.css';
import LiveHello from '@/features/onboarding/screens/LiveHello';
import InstrumentQuiz from '@/features/onboarding/screens/InstrumentQuiz';
import UseCaseQuiz from '@/features/onboarding/screens/UseCaseQuiz';
import PersonalizedSetup from '@/features/onboarding/screens/PersonalizedSetup';

// Maps the multi-select instrument quiz answer → a sensible single-value
// `displayRole` setting that ChartView already consumes.
function pickDisplayRole(instruments) {
  if (!instruments || instruments.length === 0) return 'leader';
  if (instruments.includes('vocals') && instruments.length === 1) return 'vocalist';
  if (instruments.includes('drums') && !instruments.includes('guitar') && !instruments.includes('piano')) return 'drums';
  if (instruments.includes('bass') && !instruments.includes('guitar') && !instruments.includes('piano')) return 'bass';
  if (instruments.includes('piano') && !instruments.includes('guitar')) return 'keys';
  if (instruments.includes('guitar')) return 'guitar';
  return 'leader';
}

export default function OnboardingFlow({ onComplete, onSignIn }) {
  const [step, setStep] = useState('hello');
  const [instruments, setInstruments] = useState([]);
  const [useCase, setUseCase] = useState(null);
  const [transposedInHello, setTransposedInHello] = useState(false);

  const finish = () => {
    const out = {
      quizInstruments: instruments,
      quizUseCase: useCase,
      displayRole: pickDisplayRole(instruments),
    };
    // The user demonstrably transposed during Hello — credit the
    // checklist's "Transpose a song" step so progress reads 1/6.
    if (transposedInHello) out.firstTransposed = true;
    onComplete(out);
  };

  const handleSkip = () => {
    // Skip preserves whatever answers were given so far.
    finish();
  };

  if (step === 'hello') {
    return (
      <LiveHello
        onContinue={() => setStep('instrument')}
        onSkip={handleSkip}
        onSignIn={onSignIn}
        onInteract={() => setTransposedInHello(true)}
      />
    );
  }
  if (step === 'instrument') {
    return (
      <InstrumentQuiz
        value={instruments}
        onChange={setInstruments}
        onContinue={() => setStep('usecase')}
        onBack={() => setStep('hello')}
        onSkip={handleSkip}
      />
    );
  }
  if (step === 'usecase') {
    return (
      <UseCaseQuiz
        value={useCase}
        onChange={setUseCase}
        onContinue={() => setStep('setup')}
        onBack={() => setStep('instrument')}
        onSkip={handleSkip}
      />
    );
  }
  return (
    <PersonalizedSetup
      instruments={instruments}
      useCase={useCase}
      onContinue={finish}
      onBack={() => setStep('usecase')}
    />
  );
}
