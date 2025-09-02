'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BenefitTag,
  Domain,
  FINANCIAL_BENEFIT_TAGS,
  CAREER_BENEFIT_TAGS,
  HEALTH_BENEFIT_TAGS,
  CATEGORY_COLORS,
  getBenefitById,
} from '@/lib/benefits/benefit-tags';

interface BenefitsDiscoveryProps {
  domain: Domain;
  onComplete: (selectedTags: string[]) => void;
}

interface DragItem {
  id: string;
  tag: BenefitTag;
}

/**
 * Draggable Benefit Tag Component
 */
const DraggableBenefitTag: React.FC<{
  tag: BenefitTag;
  isDragging?: boolean;
  isOverlay?: boolean;
}> = ({ tag, isDragging = false, isOverlay = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging && !isOverlay ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative cursor-move select-none
        bg-white rounded-lg p-4 shadow-md border-2
        transition-all duration-200
        ${isDragging ? 'scale-105 shadow-xl z-50' : 'hover:scale-102 hover:shadow-lg'}
        ${CATEGORY_COLORS[tag.category]}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{tag.emoji}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">{tag.title}</h3>
          <p className="text-xs opacity-90">{tag.description}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Drop Zone Component
 */
const DropZone: React.FC<{
  id: string;
  title: string;
  subtitle: string;
  tags: BenefitTag[];
  maxItems: number;
  color: string;
  isHighlighted?: boolean;
}> = ({ id, title, subtitle, tags, maxItems, color, isHighlighted = false }) => {
  const { setNodeRef, isOver } = useSortable({
    id,
    data: {
      type: 'container',
      accepts: ['tag'],
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        ${color} rounded-lg p-4 border-2 border-dashed min-h-[200px] transition-all
        ${isOver ? 'border-blue-500 bg-blue-50 scale-102' : ''}
        ${isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
      `}
    >
      <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{subtitle}</p>
      
      <div className="space-y-2">
        <SortableContext
          items={tags.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tags.map((tag) => (
            <DraggableBenefitTag key={tag.id} tag={tag} />
          ))}
        </SortableContext>
      </div>
      
      {tags.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">Drag benefits here</p>
        </div>
      )}
      
      <div className="text-xs text-gray-500 mt-4">
        {tags.length}/{maxItems} items
      </div>
    </div>
  );
};

/**
 * Main Benefits Discovery Component
 */
export const BenefitsDiscovery: React.FC<BenefitsDiscoveryProps> = ({
  domain,
  onComplete,
}) => {
  // Get tags for the selected domain
  const domainTags = domain === 'financial' ? FINANCIAL_BENEFIT_TAGS :
                     domain === 'career' ? CAREER_BENEFIT_TAGS :
                     HEALTH_BENEFIT_TAGS;

  const [containers, setContainers] = useState<Record<string, string[]>>({
    available: domainTags.map(t => t.id),
    top5: [],
    important: [],
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string) || over.id as string;

    if (!activeContainer || !overContainer) {
      setActiveId(null);
      return;
    }

    if (activeContainer !== overContainer) {
      // Moving between containers
      setContainers((prev) => {
        const activeItems = [...prev[activeContainer]];
        const overItems = [...prev[overContainer]];
        
        const activeIndex = activeItems.indexOf(active.id as string);
        const removedItem = activeItems.splice(activeIndex, 1)[0];
        
        // Check max items constraint
        if (overContainer === 'top5' && overItems.length >= 5) {
          return prev; // Don't allow more than 5 items
        }
        if (overContainer === 'important' && overItems.length >= 7) {
          return prev; // Don't allow more than 7 items
        }
        
        overItems.push(removedItem);
        
        return {
          ...prev,
          [activeContainer]: activeItems,
          [overContainer]: overItems,
        };
      });
    } else {
      // Reordering within the same container
      const items = containers[activeContainer];
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      
      if (oldIndex !== newIndex) {
        setContainers((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
        }));
      }
    }
    
    setActiveId(null);
  };

  const findContainer = (id: string): string | undefined => {
    if (id in containers) {
      return id;
    }
    return Object.keys(containers).find((key) => containers[key].includes(id));
  };

  const canProceed = containers.top5.length >= 3;

  const handleContinue = () => {
    const selectedTags = [...containers.top5, ...containers.important];
    onComplete(selectedTags);
  };

  const activeTag = activeId ? getBenefitById(activeId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            {domain === 'financial' ? '💰' : domain === 'career' ? '💼' : '🏥'} {' '}
            {domain.charAt(0).toUpperCase() + domain.slice(1)} Motivations Discovery
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Drag the motivations that resonate most with YOU into priority order. 
            Don't think about what sounds "responsible" - think about what actually drives you.
          </p>
        </motion.div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Available Tags */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">Available Motivations</h2>
              <div className="bg-white rounded-lg p-6 shadow-lg">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <SortableContext
                    items={containers.available}
                    strategy={rectSortingStrategy}
                  >
                    {containers.available.map((tagId) => {
                      const tag = getBenefitById(tagId);
                      return tag ? <DraggableBenefitTag key={tag.id} tag={tag} /> : null;
                    })}
                  </SortableContext>
                </div>
                
                {containers.available.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <p>All motivations have been prioritized!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Priority Zones */}
            <div className="space-y-6">
              <DropZone
                id="top5"
                title="🎯 TOP 5 PRIORITIES"
                subtitle="Most important to you"
                tags={containers.top5.map(id => getBenefitById(id)!).filter(Boolean)}
                maxItems={5}
                color="bg-blue-50 border-blue-200"
                isHighlighted={containers.top5.length < 3}
              />
              
              <DropZone
                id="important"
                title="⭐ ALSO IMPORTANT"
                subtitle="Matters, but not critical"
                tags={containers.important.map(id => getBenefitById(id)!).filter(Boolean)}
                maxItems={7}
                color="bg-green-50 border-green-200"
              />
            </div>
          </div>

          <DragOverlay>
            {activeTag && (
              <DraggableBenefitTag
                tag={activeTag}
                isDragging={true}
                isOverlay={true}
              />
            )}
          </DragOverlay>
        </DndContext>

        {/* Continue Button */}
        <motion.div 
          className="flex justify-center mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: canProceed ? 1 : 0.3 }}
        >
          <button
            disabled={!canProceed}
            onClick={handleContinue}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400
                     transition-all transform hover:scale-105"
          >
            Continue to Goals Creation →
          </button>
        </motion.div>
        
        {!canProceed && (
          <p className="text-center mt-4 text-amber-600">
            Please select at least 3 top priorities to continue
          </p>
        )}
      </div>
    </div>
  );
};

export default BenefitsDiscovery;