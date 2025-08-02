import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const VoiceCommands = ({ isVisible, onClose, onVoiceAction }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const [activeTab, setActiveTab] = useState('commands');
  const [voiceHistory, setVoiceHistory] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandSuggestions, setCommandSuggestions] = useState([]);
  
  const navigate = useNavigate();
  const recognitionRef = useRef(null);

  // Voice commands configuration
  const voiceCommands = [
    {
      category: 'Navigation',
      commands: [
        { phrase: 'go to dashboard', action: () => navigate('/dashboard'), icon: '📊' },
        { phrase: 'open sales', action: () => navigate('/sales'), icon: '💰' },
        { phrase: 'open purchases', action: () => navigate('/purchases'), icon: '🛒' },
        { phrase: 'open payments', action: () => navigate('/payments'), icon: '💳' },
        { phrase: 'open parties', action: () => navigate('/parties'), icon: '👥' },
        { phrase: 'open items', action: () => navigate('/items'), icon: '📦' },
        { phrase: 'open expenses', action: () => navigate('/expenses'), icon: '💸' },
        { phrase: 'open reports', action: () => navigate('/reports'), icon: '📈' },
        { phrase: 'go back', action: () => window.history.back(), icon: '⬅️' },
        { phrase: 'go home', action: () => navigate('/dashboard'), icon: '🏠' }
      ]
    },
    {
      category: 'Actions',
      commands: [
        { phrase: 'add new sale', action: () => navigate('/sales'), icon: '➕' },
        { phrase: 'add new purchase', action: () => navigate('/purchases'), icon: '➕' },
        { phrase: 'add new payment', action: () => navigate('/payments'), icon: '➕' },
        { phrase: 'add new party', action: () => navigate('/parties'), icon: '➕' },
        { phrase: 'add new item', action: () => navigate('/items'), icon: '➕' },
        { phrase: 'add new expense', action: () => navigate('/expenses'), icon: '➕' },
        { phrase: 'search', action: () => onVoiceAction('search'), icon: '🔍' },
        { phrase: 'export data', action: () => onVoiceAction('export'), icon: '📊' },
        { phrase: 'help', action: () => onVoiceAction('help'), icon: '❓' },
        { phrase: 'settings', action: () => onVoiceAction('settings'), icon: '⚙️' }
      ]
    },
    {
      category: 'Data Entry',
      commands: [
        { phrase: 'save', action: () => onVoiceAction('save'), icon: '💾' },
        { phrase: 'delete', action: () => onVoiceAction('delete'), icon: '🗑️' },
        { phrase: 'edit', action: () => onVoiceAction('edit'), icon: '✏️' },
        { phrase: 'cancel', action: () => onVoiceAction('cancel'), icon: '❌' },
        { phrase: 'confirm', action: () => onVoiceAction('confirm'), icon: '✅' },
        { phrase: 'next', action: () => onVoiceAction('next'), icon: '➡️' },
        { phrase: 'previous', action: () => onVoiceAction('previous'), icon: '⬅️' },
        { phrase: 'refresh', action: () => window.location.reload(), icon: '🔄' }
      ]
    },
    {
      category: 'Quick Actions',
      commands: [
        { phrase: 'show today sales', action: () => onVoiceAction('todaySales'), icon: '📅' },
        { phrase: 'show pending payments', action: () => onVoiceAction('pendingPayments'), icon: '⏳' },
        { phrase: 'show overdue bills', action: () => onVoiceAction('overdueBills'), icon: '⚠️' },
        { phrase: 'show top customers', action: () => onVoiceAction('topCustomers'), icon: '👑' },
        { phrase: 'show low stock items', action: () => onVoiceAction('lowStock'), icon: '📉' },
        { phrase: 'show monthly report', action: () => onVoiceAction('monthlyReport'), icon: '📊' }
      ]
    }
  ];

  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
        setTranscript('');
        setConfidence(0);
      };
      
      recognitionInstance.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let maxConfidence = 0;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
          
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
          }
        }
        
        setTranscript(finalTranscript || interimTranscript);
        setConfidence(maxConfidence);
        
        if (finalTranscript) {
          processVoiceCommand(finalTranscript.toLowerCase());
        }
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          setTranscript('No speech detected. Please try again.');
        } else if (event.error === 'audio-capture') {
          setTranscript('Microphone not found. Please check your microphone.');
        } else if (event.error === 'not-allowed') {
          setTranscript('Microphone access denied. Please allow microphone access.');
        }
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
      recognitionRef.current = recognitionInstance;
    } else {
      setIsSupported(false);
      setTranscript('Speech recognition is not supported in this browser.');
    }
  }, []);

  // Load voice history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('voiceCommandHistory');
    if (saved) {
      const history = JSON.parse(saved);
      setVoiceHistory(history.slice(0, 20));
    }
  }, []);

  // Save command to history
  const saveToHistory = (command, action, success) => {
    const newCommand = {
      command,
      action: action || 'Unknown',
      success,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString()
    };
    
    const saved = localStorage.getItem('voiceCommandHistory');
    const history = saved ? JSON.parse(saved) : [];
    const updatedHistory = [newCommand, ...history].slice(0, 50);
    
    setVoiceHistory(updatedHistory.slice(0, 20));
    localStorage.setItem('voiceCommandHistory', JSON.stringify(updatedHistory));
  };

  // Process voice command
  const processVoiceCommand = (command) => {
    setCurrentCommand(command);
    
    // Find matching command
    let matchedCommand = null;
    let bestMatch = '';
    
    for (const category of voiceCommands) {
      for (const cmd of category.commands) {
        if (command.includes(cmd.phrase) || cmd.phrase.includes(command)) {
          if (cmd.phrase.length > bestMatch.length) {
            bestMatch = cmd.phrase;
            matchedCommand = cmd;
          }
        }
      }
    }
    
    if (matchedCommand) {
      try {
        matchedCommand.action();
        setTranscript(`Executed: ${matchedCommand.phrase}`);
        saveToHistory(command, matchedCommand.phrase, true);
        
        // Auto-close after successful command
        setTimeout(() => {
          onClose();
        }, 2000);
      } catch (error) {
        console.error('Error executing command:', error);
        setTranscript(`Error executing: ${matchedCommand.phrase}`);
        saveToHistory(command, matchedCommand.phrase, false);
      }
    } else {
      setTranscript(`Command not recognized: "${command}". Try saying "help" for available commands.`);
      saveToHistory(command, 'Unknown', false);
    }
  };

  // Start listening
  const startListening = () => {
    if (recognition && isSupported) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        setTranscript('Error starting voice recognition. Please try again.');
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  // Clear voice history
  const clearVoiceHistory = () => {
    setVoiceHistory([]);
    localStorage.removeItem('voiceCommandHistory');
  };

  // Get confidence color
  const getConfidenceColor = (conf) => {
    if (conf > 0.8) return 'text-green-600';
    if (conf > 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get all commands for search
  const getAllCommands = () => {
    return voiceCommands.flatMap(category => 
      category.commands.map(cmd => ({
        ...cmd,
        category: category.category
      }))
    );
  };

  // Filter commands based on current input
  useEffect(() => {
    if (currentCommand) {
      const allCommands = getAllCommands();
      const filtered = allCommands.filter(cmd => 
        cmd.phrase.toLowerCase().includes(currentCommand.toLowerCase())
      );
      setCommandSuggestions(filtered.slice(0, 5));
    } else {
      setCommandSuggestions([]);
    }
  }, [currentCommand]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎤</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Voice Commands</h2>
              <p className="text-sm text-gray-600">Control your app with voice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('commands')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'commands'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🎤</span>
            <span>Voice</span>
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'help'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>❓</span>
            <span>Commands</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>📚</span>
            <span>History</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'commands' && (
            <div className="space-y-6">
              {/* Voice Recognition Status */}
              <div className="text-center">
                {!isSupported ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-red-600 mb-2">
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-red-900 mb-2">Not Supported</h3>
                    <p className="text-red-700">Speech recognition is not supported in this browser.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Microphone Button */}
                    <button
                      onClick={isListening ? stopListening : startListening}
                      disabled={!isSupported}
                      className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl transition-all duration-300 ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      } ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isListening ? '⏹️' : '🎤'}
                    </button>
                    
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        {isListening ? 'Listening...' : 'Tap to start speaking'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isListening ? 'Speak your command clearly' : 'Say "help" for available commands'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Transcript Display */}
              {transcript && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Transcript</h3>
                    {confidence > 0 && (
                      <span className={`text-xs font-medium ${getConfidenceColor(confidence)}`}>
                        Confidence: {Math.round(confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900">{transcript}</p>
                </div>
              )}

              {/* Command Suggestions */}
              {commandSuggestions.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-700 mb-2">Did you mean?</h3>
                  <div className="space-y-2">
                    {commandSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => processVoiceCommand(suggestion.phrase)}
                        className="w-full flex items-center space-x-2 p-2 text-left hover:bg-blue-100 rounded transition-colors"
                      >
                        <span>{suggestion.icon}</span>
                        <span className="text-sm text-blue-900">{suggestion.phrase}</span>
                        <span className="text-xs text-blue-600">({suggestion.category})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Start Guide */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-800 mb-2">Quick Start</h3>
                <div className="space-y-1 text-sm text-green-700">
                  <p>• Say "go to sales" to navigate to sales</p>
                  <p>• Say "add new party" to create a new party</p>
                  <p>• Say "search" to open search</p>
                  <p>• Say "help" to see all commands</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'help' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Voice Commands</h3>
                <p className="text-gray-600">Say any of these phrases to control your app</p>
              </div>

              {voiceCommands.map((category, categoryIndex) => (
                <div key={categoryIndex} className="space-y-3">
                  <h4 className="text-md font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    {category.category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.commands.map((command, commandIndex) => (
                      <div
                        key={commandIndex}
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-lg">{command.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{command.phrase}</p>
                          <p className="text-xs text-gray-500">Tap to test</p>
                        </div>
                        <button
                          onClick={() => processVoiceCommand(command.phrase)}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          Test
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Tips */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">💡 Tips for Better Recognition</h3>
                <div className="space-y-1 text-sm text-yellow-700">
                  <p>• Speak clearly and at a normal pace</p>
                  <p>• Use a quiet environment</p>
                  <p>• Keep your device close to your mouth</p>
                  <p>• Use the exact phrases listed above</p>
                  <p>• Wait for the "Listening..." indicator</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Voice Command History</h3>
                {voiceHistory.length > 0 && (
                  <button
                    onClick={clearVoiceHistory}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {voiceHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No voice command history</h3>
                  <p className="text-gray-600">Your voice commands will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {voiceHistory.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        item.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`text-lg ${item.success ? 'text-green-600' : 'text-red-600'}`}>
                          {item.success ? '✅' : '❌'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{item.command}</p>
                          <p className="text-sm text-gray-500">
                            {item.action} • {item.date}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => processVoiceCommand(item.command)}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {isListening ? 'Listening for commands...' : 'Ready for voice input'}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowTutorial(!showTutorial)}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              Tutorial
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tutorial Modal */}
        {showTutorial && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Voice Commands Tutorial</h3>
                <button
                  onClick={() => setShowTutorial(false)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🎤 How to Use Voice Commands</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                      <li>Tap the microphone button to start listening</li>
                      <li>Speak your command clearly</li>
                      <li>Wait for the app to process your command</li>
                      <li>The action will be executed automatically</li>
                    </ol>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🗣️ Example Commands</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">"Go to sales"</span>
                        <p className="text-gray-600">Navigate to sales page</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">"Add new party"</span>
                        <p className="text-gray-600">Create a new party</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">"Search"</span>
                        <p className="text-gray-600">Open search function</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">"Help"</span>
                        <p className="text-gray-600">Show all commands</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">💡 Best Practices</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      <li>Use a quiet environment for better recognition</li>
                      <li>Speak at a normal pace and volume</li>
                      <li>Use the exact phrases listed in the commands tab</li>
                      <li>Keep your device close to your mouth</li>
                      <li>Wait for the "Listening..." indicator before speaking</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowTutorial(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceCommands; 