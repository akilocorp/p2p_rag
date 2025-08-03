import React, { useState } from 'react';
import { FiCheck } from 'react-icons/fi';

const InteractiveSurveyQuestion = ({ questionData, onSubmit }) => {
  const [selectedValue, setSelectedValue] = useState('');
  const [selectedValues, setSelectedValues] = useState([]);
  const [textValue, setTextValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    let answer = '';
    
    switch (questionData.type) {
      case 'multiple_choice':
      case 'dropdown':
      case 'yes_no':
        answer = selectedValue;
        break;
      case 'scale':
        answer = selectedValue;
        break;
      case 'multiple_select':
        answer = selectedValues.join(', ');
        break;
      case 'open_ended':
        answer = textValue;
        break;
      default:
        answer = selectedValue || textValue;
    }

    if (questionData.required && !answer) {
      alert('This question is required. Please provide an answer.');
      return;
    }

    setIsSubmitting(true);
    await onSubmit(answer);
    setIsSubmitting(false);
  };

  const handleCheckboxChange = (option, checked) => {
    if (checked) {
      setSelectedValues([...selectedValues, option]);
    } else {
      setSelectedValues(selectedValues.filter(v => v !== option));
    }
  };

  const renderQuestionInput = () => {
    switch (questionData.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {questionData.options.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-700/30 transition-colors">
                <input
                  type="radio"
                  name="survey_question"
                  value={option}
                  checked={selectedValue === option}
                  onChange={(e) => setSelectedValue(e.target.value)}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                />
                <span className="text-gray-200">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'dropdown':
        return (
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white"
          >
            <option value="">{questionData.placeholder || 'Select an option'}</option>
            {questionData.options.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">
                {questionData.scale_labels?.[0] || questionData.scale_min}
              </span>
              <span className="text-sm text-gray-400">
                {questionData.scale_labels?.[questionData.scale_labels.length - 1] || questionData.scale_max}
              </span>
            </div>
            <div className="flex justify-between items-center space-x-2">
              {Array.from({ length: questionData.scale_max - questionData.scale_min + 1 }, (_, i) => {
                const value = questionData.scale_min + i;
                const label = questionData.scale_labels?.[i] || value;
                return (
                  <label key={value} className="flex flex-col items-center space-y-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scale_question"
                      value={value}
                      checked={selectedValue == value}
                      onChange={(e) => setSelectedValue(e.target.value)}
                      className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-400 text-center max-w-[60px]">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex space-x-6">
            <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-700/30 transition-colors">
              <input
                type="radio"
                name="yes_no_question"
                value="Yes"
                checked={selectedValue === 'Yes'}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
              />
              <span className="text-gray-200">Yes</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-700/30 transition-colors">
              <input
                type="radio"
                name="yes_no_question"
                value="No"
                checked={selectedValue === 'No'}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
              />
              <span className="text-gray-200">No</span>
            </label>
          </div>
        );

      case 'multiple_select':
        return (
          <div className="space-y-3">
            {questionData.options.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-700/30 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => handleCheckboxChange(option, e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="text-gray-200">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'open_ended':
        return (
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={questionData.placeholder || 'Enter your response...'}
            rows={4}
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-gray-400 resize-none"
          />
        );

      default:
        return (
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Enter your response..."
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-gray-400"
          />
        );
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 max-w-[80%]">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-white mb-4">{questionData.question}</h3>
        {questionData.required && (
          <p className="text-sm text-red-400 mb-4">* This question is required</p>
        )}
      </div>
      
      <div className="mb-6">
        {renderQuestionInput()}
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <FiCheck className="w-4 h-4" />
              <span>Submit Answer</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InteractiveSurveyQuestion;
