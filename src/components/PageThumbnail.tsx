import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { RotateCw, Trash2, Check, Move, GripVertical } from 'lucide-react';
import { PageData } from '../types';

interface PageThumbnailProps {
  page: PageData;
  index: number;
  isSelected: boolean;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
  onRotate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onSelect: (pageId: string, isSelected: boolean) => void;
}

const PageThumbnail: React.FC<PageThumbnailProps> = ({
  page,
  index,
  isSelected,
  onReorder,
  onRotate,
  onDelete,
  onSelect,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'page',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'page',
    hover(item: { index: number }) {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      onReorder(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  const handleSelect = () => {
    onSelect(page.id, !isSelected);
  };

  return (
    <div
      ref={ref}
      className={`relative group bg-gray-800 rounded-lg overflow-hidden transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isSelected ? 'ring-2 ring-purple-500' : ''} hover:scale-105 cursor-pointer`}
      onClick={handleSelect}
    >
      {/* Selection Overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-purple-500/20 z-10 flex items-center justify-center">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
        </div>
      )}

      {/* Thumbnail Image */}
      <div className="aspect-[3/4] relative overflow-hidden">
        <img
          src={page.thumbnail}
          alt={`Page ${index + 1}`}
          className="w-full h-full object-cover"
          style={{
            transform: `rotate(${page.rotation}deg)`,
            transition: 'transform 0.3s ease',
          }}
        />
        
        {/* Page Number */}
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-black/70 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
          {index + 1}
        </div>

        {/* Drag Handle */}
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/70 text-white rounded px-1.5 py-0.5 flex items-center space-x-1">
            <Move className="w-3 h-3" />
            <span className="text-xs">Drag</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute top-1 right-1 sm:top-2 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 space-y-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRotate(page.id);
            }}
            className="w-6 h-6 sm:w-8 sm:h-8 bg-black/70 hover:bg-black/90 text-white rounded flex items-center justify-center transition-colors"
            title="Rotate"
          >
            <RotateCw className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(page.id);
            }}
            className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500/80 hover:bg-red-500 text-white rounded flex items-center justify-center transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Page Info */}
      <div className="p-2 sm:p-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-300 truncate">{page.filename}</span>
            <span className="text-xs text-gray-500">
              {page.type === 'pdf' ? 'PDF' : 'Image'}
            </span>
          </div>
          {page.type === 'pdf' && page.totalPages && page.totalPages > 1 && (
            <div className="text-xs text-blue-400">
              {page.totalPages} pages
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageThumbnail;