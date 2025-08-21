import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Zap, Shield, Sparkles, Edit3, Type } from 'lucide-react';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: FileText,
      title: 'Smart PDF Processing',
      description: 'Upload, merge, split, and manipulate PDFs with advanced tools'
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'All processing happens locally in your browser - your files never leave your device'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Instant thumbnail generation and real-time editing with smooth performance'
    },
    {
      icon: Sparkles,
      title: 'OCR & Compression',
      description: 'Make scanned PDFs searchable and compress images to reduce file sizes'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Hero Section */}
      <main className="relative z-10 pt-20 sm:pt-32 pb-16 sm:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white mb-6 sm:mb-8">
            Modern PDF
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {' '}Toolbox
            </span>
          </h1>
          
          <p className="text-base sm:text-xl text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
            Upload, edit, merge, and export PDFs with our powerful client-side processor. 
            Add OCR for searchable text, compress images, and maintain complete privacy.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/editor"
              className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/25 text-sm sm:text-base"
            >
              <FileText className="w-5 h-5 mr-2" />
              Open Editor
            </Link>
            
            <Link
              to="/pdf-editor"
              className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-teal-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-green-500/25 text-sm sm:text-base"
            >
              <Type className="w-5 h-5 mr-2" />
              PDF Editor
            </Link>
            
            <Link
              to="/convert"
              className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-xl hover:from-orange-700 hover:to-red-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-orange-500/25 text-sm sm:text-base"
            >
              <Zap className="w-5 h-5 mr-2" />
              Bulk Convert
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Edit3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">PDF Editor</h3>
                  <p className="text-gray-400">Merge, split, and organize PDFs</p>
                </div>
              </div>
              <Link
                to="/editor"
                className="inline-flex items-center text-purple-400 hover:text-purple-300 font-medium"
              >
                Start Editing →
              </Link>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <Type className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Advanced PDF Editor</h3>
                  <p className="text-gray-400">Professional text editing and annotations</p>
                </div>
              </div>
              <Link
                to="/pdf-editor"
                className="inline-flex items-center text-green-400 hover:text-green-300 font-medium"
              >
                Start Editing →
              </Link>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 hover:border-orange-500/50 transition-all duration-300">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Bulk Converter</h3>
                  <p className="text-gray-400">Convert multiple files at once</p>
                </div>
              </div>
              <Link
                to="/convert"
                className="inline-flex items-center text-orange-400 hover:text-orange-300 font-medium"
              >
                Start Converting →
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 sm:mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">
            Powerful Features
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 sm:p-6 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-3">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Background Effects */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 right-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 sm:w-96 sm:h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-2000"></div>
      </div>
    </div>
  );
};

export default LandingPage;