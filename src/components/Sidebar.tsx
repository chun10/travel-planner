import React from 'react';
import { ItineraryDay } from '../lib/types';
import { CalendarDays, MapPin, Users, Share2, Menu, Plus } from 'lucide-react';

interface SidebarProps {
  days: ItineraryDay[];
  selectedDayId: string;
  onSelectDay: (id: string) => void;
  onAddDay: () => void;
}

export default function Sidebar({ days, selectedDayId, onSelectDay, onAddDay }: SidebarProps) {
  return (
    <div className="w-64 bg-slate-50 border-r border-slate-200 h-screen flex flex-col flex-shrink-0 shadow-sm z-10">
      <div className="p-4 border-b border-slate-200 flex items-center gap-2">
        <MapPin className="text-blue-600" />
        <h1 className="font-bold text-lg text-slate-800 tracking-tight">TripPlanner</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2 flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>行程天數 (Itinerary)</span>
        </div>
        
        <div className="flex flex-col gap-1 px-2 mb-4">
          {days.map((day, index) => (
            <button
              key={day.id}
              onClick={() => onSelectDay(day.id)}
              className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                selectedDayId === day.id
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                selectedDayId === day.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                D{index + 1}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm truncate font-medium">{day.title}</span>
                <span className="text-xs opacity-80 mt-0.5">{day.date}</span>
              </div>
            </button>
          ))}
        </div>

        {/* 新增天數按鈕 */}
        <div className="px-4 mt-2">
          <button 
            onClick={onAddDay}
            className="flex items-center gap-2 w-full justify-center bg-transparent border-2 border-dashed border-slate-300 text-slate-500 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 text-sm font-medium transition-all"
          >
            <Plus size={16} />
            <span>新增天數</span>
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200">
        <button className="flex items-center gap-2 w-full justify-center bg-white border border-slate-300 text-slate-700 py-2 rounded-md hover:bg-slate-50 text-sm font-medium transition-colors">
          <Users size={16} />
          <span>管理共用編輯者 (3)</span>
        </button>
        <button className="flex items-center gap-2 w-full justify-center bg-blue-600 text-white py-2 mt-2 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors">
          <Share2 size={16} />
          <span>分享行程連結</span>
        </button>
      </div>
    </div>
  );
}
