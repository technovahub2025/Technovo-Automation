import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, Download, Trash2, Plus, Globe, Volume2, Clock, BarChart3 } from 'lucide-react';
import { ivrService } from '../../services/ivrService';

const IVRManagement = () => {
  const [prompts, setPrompts] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [generatingAudio, setGeneratingAudio] = useState({});
  const [stats, setStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    promptKey: '',
    text: '',
    languages: ['en-US']
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [promptsData, languagesData, statsData] = await Promise.all([
        ivrService.getPrompts(),
        ivrService.getLanguages(),
        ivrService.getStats()
      ]);
      
      setPrompts(promptsData.data);
      setLanguages(languagesData.data);
      setStats(statsData.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAudio = async (promptKey, text, language) => {
    const key = `${promptKey}-${language}`;
    setGeneratingAudio(prev => ({ ...prev, [key]: true }));
    
    try {
      await ivrService.generateAudio(promptKey, text, language);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to generate audio:', error);
    } finally {
      setGeneratingAudio(prev => ({ ...prev, [key]: false }));
    }
  };

  const generateAllLanguages = async (promptKey, text) => {
    setGeneratingAudio(prev => ({ ...prev, [promptKey]: true }));
    
    try {
      await ivrService.generateAllLanguages(promptKey, text);
      await loadData();
    } catch (error) {
      console.error('Failed to generate audio for all languages:', error);
    } finally {
      setGeneratingAudio(prev => ({ ...prev, [promptKey]: false }));
    }
  };

  const deleteAudio = async (promptKey, language) => {
    if (!confirm(`Are you sure you want to delete the ${language} audio for ${promptKey}?`)) {
      return;
    }
    
    try {
      await ivrService.deleteAudio(promptKey, language);
      await loadData();
    } catch (error) {
      console.error('Failed to delete audio:', error);
    }
  };

  const playAudio = (audioUrl) => {
    const audio = new Audio(audioUrl);
    audio.play();
  };

  const createNewPrompt = async () => {
    try {
      await ivrService.generateAllLanguages(
        newPrompt.promptKey,
        newPrompt.text,
        true
      );
      setShowCreateModal(false);
      setNewPrompt({ promptKey: '', text: '', languages: ['en-US'] });
      await loadData();
    } catch (error) {
      console.error('Failed to create prompt:', error);
    }
  };

  const getLanguageName = (code) => {
    const lang = languages.find(l => l.code === code);
    return lang ? lang.name : code;
  };

  const getLanguageIcon = (code) => {
    const icons = {
      'en-US': '🇺🇸',
      'ta-IN': '🇮🇳',
      'hi-IN': '🇮🇳'
    };
    return icons[code] || '🌐';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">IVR Management</h1>
            <p className="text-gray-600 mt-2">Manage multilingual IVR prompts and audio files</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Prompt
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Volume2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Prompts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPrompts}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Play className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Plays</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPlays}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Languages</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.languages?.length || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.languages?.reduce((acc, lang) => acc + (lang.avgDuration || 0), 0) / (stats.languages?.length || 1) || 0}s
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prompts List */}
      <div className="space-y-6">
        {prompts.map((prompt) => (
          <div key={prompt.promptKey} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{prompt.promptKey}</h3>
                  <p className="text-gray-600 text-sm">{prompt.text}</p>
                  {prompt.menuConfig?.type && (
                    <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {prompt.menuConfig.type}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => generateAllLanguages(prompt.promptKey, prompt.text)}
                  disabled={generatingAudio[prompt.promptKey]}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingAudio[prompt.promptKey] ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Generate All
                </button>
              </div>

              {/* Language Audio Files */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['en-US', 'ta-IN', 'hi-IN'].map((language) => {
                  const audioFile = prompt.audioFiles?.find(af => af.language === language);
                  const isGenerating = generatingAudio[`${prompt.promptKey}-${language}`];
                  
                  return (
                    <div key={language} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getLanguageIcon(language)}</span>
                          <span className="font-medium text-gray-900">{getLanguageName(language)}</span>
                        </div>
                        {audioFile && (
                          <span className="text-xs text-gray-500">
                            {audioFile.playCount} plays
                          </span>
                        )}
                      </div>

                      {audioFile ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => playAudio(audioFile.audioUrl)}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                            >
                              <Play className="w-3 h-3" />
                              Play
                            </button>
                            <a
                              href={audioFile.audioUrl}
                              download
                              className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                            <button
                              onClick={() => deleteAudio(prompt.promptKey, language)}
                              className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            Generated: {new Date(audioFile.generatedAt).toLocaleDateString()}
                            {audioFile.duration && ` • ${audioFile.duration.toFixed(1)}s`}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500">No audio generated</p>
                          <button
                            onClick={() => generateAudio(prompt.promptKey, prompt.text, language)}
                            disabled={isGenerating}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            {isGenerating ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Volume2 className="w-3 h-3" />
                            )}
                            Generate
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create New Prompt Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Prompt</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Key
                </label>
                <input
                  type="text"
                  value={newPrompt.promptKey}
                  onChange={(e) => setNewPrompt(prev => ({ ...prev, promptKey: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., welcome_message"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Text Content
                </label>
                <textarea
                  value={newPrompt.text}
                  onChange={(e) => setNewPrompt(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Enter the text to be converted to speech..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Languages
                </label>
                <div className="space-y-2">
                  {['en-US', 'ta-IN', 'hi-IN'].map((lang) => (
                    <label key={lang} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newPrompt.languages.includes(lang)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewPrompt(prev => ({ ...prev, languages: [...prev.languages, lang] }));
                          } else {
                            setNewPrompt(prev => ({ ...prev, languages: prev.languages.filter(l => l !== lang) }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{getLanguageName(lang)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createNewPrompt}
                disabled={!newPrompt.promptKey || !newPrompt.text || newPrompt.languages.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IVRManagement;
