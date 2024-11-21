import React from 'react';
import { LucideIcon } from 'lucide-react';

type Step = {
  title: string;
  icon: LucideIcon;
};

type Props = {
  currentStep: number;
  steps: Step[];
};

const ProgressBar: React.FC<Props> = ({ currentStep, steps }) => {
  return (
    <div className="relative">
      <div className="absolute top-5 w-full h-0.5 bg-gray-200">
        <div
          className="h-full bg-indigo-600 transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
      </div>
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className={`flex flex-col items-center ${index <= currentStep ? 'text-indigo-600' : 'text-gray-400'
                }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${index <= currentStep
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-400'
                  }`}
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