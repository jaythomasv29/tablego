import React from 'react';

type ProgressIcon = React.ComponentType<{ className?: string }>;

interface Props {
  currentStep: number;
  steps: { title: string; icon: ProgressIcon; }[];
  onStepClick: (stepIndex: number) => void;
}

const ProgressBar: React.FC<Props> = ({ currentStep, steps, onStepClick }) => {
  const accentColor = '#A3B18A';
  const accentTextColor = '#6B7758';

  return (
    <div className="relative">
      <div className="absolute top-5 w-full h-0.5 bg-gray-200">
        <div
          className="h-full transition-all duration-500"
          style={{ backgroundColor: accentColor, width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
      </div>
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= currentStep;
          return (
            <div
              key={step.title}
              className={`flex flex-col items-center ${isActive ? '' : 'text-gray-400'}`}
              style={isActive ? { color: accentTextColor } : undefined}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'text-zinc-900' : 'bg-gray-200 text-gray-400'}`}
                style={isActive ? { backgroundColor: accentColor } : undefined}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="mt-2 text-sm font-medium">{step.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressBar;