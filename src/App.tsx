import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import LandingPage from './components/LandingPage';
import EditorPage from './components/EditorPage';
import BulkConverterPage from './components/BulkConverterPage';
import ApryseEditor from './components/ApryseEditor';
import Navigation from './components/Navigation';

function App() {
  return (
    <Router>
      <DndProvider backend={HTML5Backend}>
        <div className="min-h-screen bg-gray-900">
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'bg-gray-800 text-white border border-gray-700',
              duration: 4000,
            }}
          />
          <Navigation />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/pdf-editor" element={<ApryseEditor />} />
            <Route path="/convert" element={<BulkConverterPage />} />
          </Routes>
        </div>
      </DndProvider>
    </Router>
  );
}

export default App;