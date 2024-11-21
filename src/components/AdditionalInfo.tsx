import React from 'react';
import { MessageSquare } from 'lucide-react';

type Props = {
  comments: string;
  onUpdate: (data: { comments: string }) => void;
};

const AdditionalInfo: React.FC<Props> = ({ comments, onUpdate }) => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Additional Information
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4" />
            <span>Special Requests or Comments</span>
          </div>
        </label>
        <textarea
          value={comments}
          onChange={(e) => onUpdate({ comments: e.target.value })}
          placeholder="Any dietary restrictions, special occasions, or seating preferences?"
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
    </div>
  );
};

export default AdditionalInfo;