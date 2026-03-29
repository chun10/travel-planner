import React, { useState, useRef, memo } from 'react';
import { ItineraryDay, TransportMode, EventLink, DayEvent, EventType } from '../lib/types';
import { 
  MapPin, 
  Bus, 
  Footprints, 
  Car, 
  ExternalLink, 
  Plane, 
  Hotel, 
  Ticket, 
  PlusCircle,
  GripVertical,
  Edit2,
  Trash2,
  Check,
  X,
  Calendar,
  Navigation,
  FileText,
  Map as MapIcon,
  Train,
  ChevronDown,
  Globe,
  Link2
} from 'lucide-react';

interface TripLink {
  id: string;
  title: string;
  url: string;
}

interface TimelineProps {
  day: ItineraryDay;
  onUpdateEvent: (eventId: string, updatedEvent: DayEvent) => void;
  onAddEvent: () => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteDay: (dayId: string) => void;
  onUpdateDayTitle: (newTitle: string) => void;
  onUpdateDayDate: (newDate: string) => void;
  onUpdateDayNotes: (newNotes: string) => void;
  tripLinks: TripLink[];
  onAddTripLink: () => void;
  onUpdateTripLink: (id: string, field: 'title' | 'url', value: string) => void;
  onDeleteTripLink: (id: string) => void;
  onSaveTripLinks?: () => void; // Callback to trigger sync when editing is done
}

const getTransportIcon = (mode: TransportMode, className?: string) => {
  switch (mode) {
    case 'TRANSIT': return <Bus size={14} className={className || "text-orange-500"} />;
    case 'WALKING': return <Footprints size={14} className={className || "text-emerald-500"} />;
    case 'DRIVING': return <Car size={14} className={className || "text-blue-500"} />;
    default: return null;
  }
};

const getLinkIcon = (type: EventLink['type']) => {
  switch (type) {
    case 'flight': return <Plane size={12} className="text-blue-500 mr-1" />;
    case 'hotel': return <Hotel size={12} className="text-purple-500 mr-1" />;
    case 'booking': return <Ticket size={12} className="text-orange-500 mr-1" />;
    default: return <ExternalLink size={12} className="text-gray-500 mr-1" />;
  }
};

const EVENT_TYPES: { value: EventType; label: string; icon: any }[] = [
  { value: 'default', label: '地點', icon: MapPin },
  { value: 'attraction', label: '景點/遊樂園', icon: Ticket },
  { value: 'hotel', label: '住宿', icon: Hotel },
  { value: 'flight', label: '飛機', icon: Plane },
  { value: 'transit', label: '地鐵/交通', icon: Train },
];

const getEventIconProps = (type: EventType = 'default') => {
  switch (type) {
    case 'hotel': return { icon: <Hotel size={16} />, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' };
    case 'flight': return { icon: <Plane size={16} />, color: 'text-sky-600', bg: 'bg-sky-100', border: 'border-sky-200' };
    case 'transit': return { icon: <Train size={16} />, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' };
    case 'attraction': return { icon: <Ticket size={16} />, color: 'text-pink-600', bg: 'bg-pink-100', border: 'border-pink-200' };
    default: return { icon: <MapPin size={16} />, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' };
  }
};

function Timeline({ 
  day, 
  onUpdateEvent, 
  onAddEvent, 
  onDeleteEvent,
  onDeleteDay,
  onUpdateDayTitle,
  onUpdateDayDate,
  onUpdateDayNotes,
  tripLinks,
  onAddTripLink,
  onUpdateTripLink,
  onDeleteTripLink,
  onSaveTripLinks
}: TimelineProps) {
  if (!day) return null;

  // Tabs state
  const [viewMode, setViewMode] = useState<'itinerary' | 'notes'>('itinerary');

  // Notes state
  const [notesInput, setNotesInput] = useState(day.notes || '');

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DayEvent>>({});
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(day.title);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(day.date);

  const [editingTransportEventId, setEditingTransportEventId] = useState<string | null>(null);
  const [transportForm, setTransportForm] = useState<Partial<NonNullable<DayEvent['transportToNext']>>>({});

// Use ref + localStorage + useState combo for persistent expanded state
  const expandedIdsRef = useRef<string[]>([]);
  const [expandedIdsState, setExpandedIdsState] = useState<string[]>([]);
  
  // Initialize from localStorage on first render only
  const isExpandedInitialized = useRef(false);
  if (!isExpandedInitialized.current && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('trip-expanded-ids');
      if (saved) {
        expandedIdsRef.current = JSON.parse(saved);
        setExpandedIdsState(expandedIdsRef.current);
      }
    } catch {}
    isExpandedInitialized.current = true;
  }
  
  // Use the state value for rendering
  const displayExpandedIds = expandedIdsState.length > 0 ? expandedIdsState : expandedIdsRef.current;
  
  // Actual expanded ids for use in component
  const expandedIds = displayExpandedIds;
  
  const setExpandedIds = (ids: string[]) => {
    expandedIdsRef.current = ids;
    setExpandedIdsState(ids);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trip-expanded-ids', JSON.stringify(ids));
    }
  };
  
  const [editingTripLinkIds, setEditingTripLinkIds] = useState<Set<string>>(new Set());
  const prevTripLinksLength = useRef(tripLinks.length);
  
// Auto-start editing for newly added links
  React.useEffect(() => {
    if (tripLinks.length > prevTripLinksLength.current) {
      const newLink = tripLinks[tripLinks.length - 1];
      if (newLink && !newLink.title && !newLink.url) {
        setEditingTripLinkIds(prev => new Set(prev).add(newLink.id));
      }
    }
    prevTripLinksLength.current = tripLinks.length;
  }, [tripLinks.length]);

const toggleExpand = (id: string) => {
    const newIds = expandedIds.includes(id) 
      ? expandedIds.filter(x => x !== id) 
      : [...expandedIds, id];
    setExpandedIds(newIds);
  };

  const startEditingTripLink = (id: string) => {
    setEditingTripLinkIds(prev => new Set(prev).add(id));
  };

  const stopEditingTripLink = (id: string) => {
    setEditingTripLinkIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (onSaveTripLinks) {
      onSaveTripLinks();
    }
  };
  
  React.useEffect(() => {
    setTitleInput(day.title);
    setDateInput(day.date);
    setNotesInput(day.notes || '');
    setIsEditingTitle(false);
    setIsEditingDate(false);
  }, [day.id, day.title, day.date, day.notes]);

  const startEditing = (event: DayEvent) => {
    setEditingEventId(event.id);
    setEditForm({ ...event });
  };

  const cancelEditing = () => {
    setEditingEventId(null);
    setEditForm({});
  };

  const saveEditing = () => {
    if (editingEventId && editForm) {
      if (!editForm.time || !editForm.locationName) return;
      onUpdateEvent(editingEventId, editForm as DayEvent);
      setEditingEventId(null);
      setEditForm({});
    }
  };

  const startEditingTransport = (event: DayEvent, isNew = false) => {
    setEditingTransportEventId(event.id);
    if (isNew || !event.transportToNext) {
      setTransportForm({ mode: 'TRANSIT', duration: '', instructions: '' });
    } else {
      setTransportForm({ ...event.transportToNext });
    }
  };

  const cancelEditingTransport = () => {
    setEditingTransportEventId(null);
    setTransportForm({});
  };

  const saveTransport = (event: DayEvent) => {
    if (editingTransportEventId) {
      const updatedEvent = {
        ...event,
        transportToNext: transportForm as DayEvent['transportToNext']
      };
      onUpdateEvent(event.id, updatedEvent);
      setEditingTransportEventId(null);
      setTransportForm({});
    }
  };

  const removeTransport = (event: DayEvent) => {
    const updatedEvent = { ...event };
    delete updatedEvent.transportToNext;
    onUpdateEvent(event.id, updatedEvent);
  };

  const saveTitle = () => {
    onUpdateDayTitle(titleInput);
    setIsEditingTitle(false);
  };

  const saveDate = () => {
    onUpdateDayDate(dateInput);
    setIsEditingDate(false);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotesInput(e.target.value);
    onUpdateDayNotes(e.target.value);
  };

  // Link management functions
  const addLink = () => {
    setEditForm({
      ...editForm,
      links: [...(editForm.links || []), { id: crypto.randomUUID(), title: '', url: '', type: 'booking' }]
    });
  };

  const updateLink = (id: string, field: keyof EventLink, value: string) => {
    setEditForm({
      ...editForm,
      links: editForm.links?.map(l => l.id === id ? { ...l, [field]: value } : l)
    });
  };

  const removeLink = (id: string) => {
    setEditForm({
      ...editForm,
      links: editForm.links?.filter(l => l.id !== id)
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* Day Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-20 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)] px-5 pt-5 pb-3 border-b border-slate-200 flex flex-col gap-3">
        <div className="flex justify-between items-start gap-2">
          
          <div className="flex-1 w-full overflow-hidden">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="text-xl font-extrabold text-slate-800 border-b-2 border-blue-500 focus:outline-none bg-transparent w-full"
                  autoFocus
                />
                <button onClick={saveTitle} className="text-green-600 p-1.5 hover:bg-green-50 rounded-full shrink-0"><Check size={18} /></button>
                <button onClick={() => { setIsEditingTitle(false); setTitleInput(day.title); }} className="text-slate-400 p-1.5 hover:bg-slate-50 rounded-full shrink-0"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <h2 className="text-xl font-extrabold text-slate-800 truncate">{day.title}</h2>
                <Edit2 size={14} className="text-slate-300" />
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center">
            {isEditingDate ? (
              <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="bg-transparent text-blue-800 text-xs font-bold focus:outline-none w-24"
                  autoFocus
                />
                <button onClick={saveDate} className="text-green-600 hover:text-green-800"><Check size={14} /></button>
              </div>
            ) : (
              <div 
                className="cursor-pointer flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1.5 rounded-full border border-blue-200"
                onClick={() => setIsEditingDate(true)}
              >
                <Calendar size={12} className="text-blue-600" />
                <span>{day.date || '選擇日期'}</span>
              </div>
            )}
          </div>

          {/* Delete Day Button */}
          <button
            onClick={() => {
              if (confirm('確定要刪除此天嗎？')) {
                onDeleteDay(day.id);
              }
            }}
            className="shrink-0 ml-2 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="刪除此天"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* View Toggle (Itinerary vs Notes) */}
        <div className="flex bg-slate-100 p-1 rounded-xl mt-1">
          <button 
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 text-sm font-bold rounded-lg transition-all ${
              viewMode === 'itinerary' 
                ? 'bg-white shadow-sm text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setViewMode('itinerary')}
          >
            <MapIcon size={14} /> 行程安排
          </button>
          <button 
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 text-sm font-bold rounded-lg transition-all ${
              viewMode === 'notes' 
                ? 'bg-white shadow-sm text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setViewMode('notes')}
          >
            <FileText size={14} /> 旅遊筆記
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32">
        {viewMode === 'itinerary' ? (
          /* ================================== */
          /* ITINERARY VIEW (Timeline)          */
          /* ================================== */
          <div className="relative pl-2">
            {/* Vertical Track Line */}
            <div className="absolute left-[28px] top-6 bottom-6 w-[3px] bg-slate-200 rounded-full" />

            {day.events.length === 0 && (
               <div className="text-center text-slate-400 py-16 font-medium text-sm flex flex-col items-center gap-4 relative z-10">
                 <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                   <MapPin size={24} className="text-slate-300" />
                 </div>
                 準備去哪裡玩？點擊下方按鈕加入行程吧！
               </div>
            )}
            
            {day.events.map((event, index) => {
              const isEditing = editingEventId === event.id;
              const { icon: EventIcon, color, bg, border } = getEventIconProps(event.eventType);

              return (
                <div key={event.id} className="relative mb-6">
                  <div className="flex items-start gap-4 relative">
                    
                    {/* Time Badge */}
                    <div className="flex flex-col items-center z-10 w-[50px] shrink-0 pt-2">
                      {isEditing ? (
                        <input 
                          type="time" 
                          value={editForm.time || ''} 
                          onChange={e => setEditForm({...editForm, time: e.target.value})}
                          className="w-full text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-300 rounded px-1 py-1 text-center"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-white rounded-full border-4 border-slate-50 flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.05)] relative z-10">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${bg} ${border}`}>
                            <span className={`text-xs font-extrabold ${color}`}>{event.time}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Event Card */}
                    <div className={`flex-1 bg-white rounded-2xl shadow-sm relative overflow-hidden transition-all
                      ${isEditing ? 'border-2 border-blue-400 ring-2 ring-blue-50 shadow-md scale-[1.02] z-20' : 'border border-slate-200'}
                    `}>
                      {isEditing ? (
                        <div className="p-4 bg-blue-50/30">
                          
                          {/* Event Type Selector */}
                          <div className="mb-4">
                             <label className="text-xs font-bold text-slate-500 mb-2 block">行程類型</label>
                             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {EVENT_TYPES.map(t => {
                                  const TypeIcon = t.icon;
                                  const isActive = (editForm.eventType === t.value) || (!editForm.eventType && t.value === 'default');
                                  return (
                                   <button 
                                     key={t.value}
                                     onClick={() => setEditForm({...editForm, eventType: t.value})}
                                     className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                                       isActive 
                                         ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                         : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                     }`}
                                   >
                                     <TypeIcon size={14}/> {t.label}
                                   </button>
                                  )
                                })}
                             </div>
                          </div>

                          <div className="mb-3">
                            <label className="text-xs font-bold text-slate-500 mb-1 block">地點 / 行程名稱</label>
                            <input 
                              type="text" 
                              value={editForm.locationName || ''} 
                              onChange={e => setEditForm({...editForm, locationName: e.target.value})}
                              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 bg-white"
                              placeholder="輸入名稱 (例如：東京迪士尼、淺草寺)"
                            />
                          </div>
                          
                          <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 mb-1 block">行程描述 / 筆記</label>
                            <textarea 
                              value={editForm.description || ''} 
                              onChange={e => setEditForm({...editForm, description: e.target.value})}
                              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white"
                              rows={2}
                              placeholder="輸入要做的活動或筆記..."
                            />
                          </div>

                          {/* Tickets & Links Editor */}
                          <div className="mb-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <Ticket size={14} className="text-orange-500"/>
                                  憑證與票券連結
                                </label>
                                <button 
                                   onClick={addLink}
                                   className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors"
                                >
                                   <PlusCircle size={12}/> 新增票券
                                </button>
                             </div>
                             
                             <div className="flex flex-col gap-2">
                                {editForm.links?.map((link) => (
                                   <div key={link.id} className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 relative">
                                      <button 
                                        onClick={() => removeLink(link.id)}
                                        className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm transition-colors"
                                      >
                                        <X size={12}/>
                                      </button>
                                      
                                      <div className="flex gap-2">
                                         <select 
                                            value={link.type} 
                                            onChange={e => updateLink(link.id, 'type', e.target.value)}
                                            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md px-1.5 py-1.5 focus:outline-blue-400 w-[70px] shrink-0"
                                         >
                                            <option value="booking">門票</option>
                                            <option value="hotel">住宿</option>
                                            <option value="flight">機票</option>
                                            <option value="other">其他</option>
                                         </select>
                                         <input 
                                            placeholder="標題 (例: Klook 門票)"
                                            value={link.title}
                                            onChange={e => updateLink(link.id, 'title', e.target.value)}
                                            className="flex-1 text-xs font-bold text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-blue-400 bg-white min-w-0"
                                         />
                                      </div>
                                      <input 
                                         placeholder="貼上網址 URL (https://...)"
                                         value={link.url}
                                         onChange={e => updateLink(link.id, 'url', e.target.value)}
                                         className="w-full text-[11px] text-slate-600 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-blue-400 bg-white"
                                      />
                                   </div>
                                ))}
                                {(!editForm.links || editForm.links.length === 0) && (
                                   <div className="text-[11px] font-medium text-slate-400 text-center py-3 border-2 border-dashed border-slate-200 rounded-lg">
                                     目前沒有任何憑證，點擊右上方新增。
                                   </div>
                                )}
                             </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-4">
                            <button onClick={cancelEditing} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-300 rounded-xl hover:bg-slate-50">取消</button>
                            <button onClick={saveEditing} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl shadow-md hover:bg-blue-700">儲存變更</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full">
                          {/* Title Row (Always Visible) */}
                          <div 
                            className="p-3.5 flex justify-between items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => toggleExpand(event.id)}
                          >
                            <div className="flex items-center gap-3">
                               <div className={`${bg} p-1.5 rounded-full ${color} shrink-0`}>
                                  {EventIcon}
                               </div>
                               <h3 className="text-[15px] font-extrabold text-slate-800 leading-tight truncate">
                                 {event.locationName}
                               </h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                               <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${expandedIds.includes(event.id) ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {expandedIds.includes(event.id) && (
                            <div className="px-4 pb-4 pt-1 flex flex-col animate-in slide-in-from-top-2 duration-200 fade-in border-t border-slate-50">
                              
                              <div className="flex justify-end gap-1 mb-3">
                                <button onClick={(e) => { e.stopPropagation(); startEditing(event); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white rounded-full shadow-sm border border-slate-100" title="編輯">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors bg-white rounded-full shadow-sm border border-slate-100" title="刪除">
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              {/* Description */}
                              {event.description && (
                                <p className="text-slate-600 text-[13px] leading-relaxed mb-4 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  {event.description}
                                </p>
                              )}

                              <div className="mt-auto flex flex-col gap-3">
                                {/* Links / Vouchers */}
                                {event.links && event.links.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {event.links.map(link => (
                                      <a
                                        key={link.id}
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all hover:bg-slate-200"
                                      >
                                        {getLinkIcon(link.type)}
                                        {link.title}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Navigate Button */}
                                <div className="flex justify-end pt-2 border-t border-slate-100">
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.locationName)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-blue-100 active:scale-95 transition-transform"
                                  >
                                    <Navigation size={12} className="fill-blue-600/20" />
                                    導航前往
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transport Info Box */}
                  {!isEditing && editingTransportEventId === event.id ? (
                    <div className="ml-[18px] mt-2 mb-4 bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex flex-col gap-3 relative z-20 shadow-sm animate-in zoom-in-95 duration-200">
                      <div className="flex gap-2">
                        {['TRANSIT', 'WALKING', 'DRIVING'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => setTransportForm({...transportForm, mode: mode as TransportMode})}
                            className={`flex-1 py-2 flex justify-center items-center rounded-xl border-2 transition-all ${
                              transportForm.mode === mode 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {getTransportIcon(mode as TransportMode, transportForm.mode === mode ? "text-white" : undefined)}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          placeholder="出發站 (例：新宿)"
                          value={transportForm.fromStation || ''}
                          onChange={e => setTransportForm({...transportForm, fromStation: e.target.value})}
                          className="flex-1 text-sm font-bold p-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                        />
                        <span className="flex items-center text-slate-400 font-bold">→</span>
                        <input 
                          placeholder="到達站 (例：澀谷)"
                          value={transportForm.toStation || ''}
                          onChange={e => setTransportForm({...transportForm, toStation: e.target.value})}
                          className="flex-1 text-sm font-bold p-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                      <input 
                        placeholder="預估時間 (例：約 5 分鐘)"
                        value={transportForm.duration || ''}
                        onChange={e => setTransportForm({...transportForm, duration: e.target.value})}
                        className="w-full text-sm font-bold p-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                      />
                      <input 
                        placeholder="搭乘方式 (例：JR 山手線)"
                        value={transportForm.instructions || ''}
                        onChange={e => setTransportForm({...transportForm, instructions: e.target.value})}
                        className="w-full text-sm p-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button onClick={cancelEditingTransport} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-300 rounded-xl hover:bg-slate-50">取消</button>
                        <button onClick={() => saveTransport(event)} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl shadow-md hover:bg-blue-700">儲存交通</button>
                      </div>
                    </div>
                  ) : !isEditing && event.transportToNext ? (
                    <div className="group/transport flex items-center gap-3 ml-[18px] mt-2 mb-2 relative z-10 cursor-pointer" onClick={() => startEditingTransport(event)}>
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-[3px] border-white flex items-center justify-center shrink-0 shadow-sm z-20">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      </div>
                      <div className="flex-1 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl p-2.5 flex flex-col gap-1 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] hover:bg-white hover:shadow-md transition-all relative pr-10">
                        <div className="flex items-center gap-1.5 font-bold text-slate-600 text-[11px]">
                          {getTransportIcon(event.transportToNext.mode)}
                          {event.transportToNext.fromStation && event.transportToNext.toStation ? (
                            <span>{event.transportToNext.fromStation} → {event.transportToNext.toStation}</span>
                          ) : (
                            <span>{event.transportToNext.duration}</span>
                          )}
                        </div>
                        {event.transportToNext.instructions && (
                          <div className="text-slate-500 text-[11px] leading-tight pl-0.5">
                            {event.transportToNext.instructions}
                          </div>
                        )}
                        {event.transportToNext.duration && event.transportToNext.fromStation && (
                          <div className="text-slate-400 text-[10px] leading-tight pl-0.5">
                            約 {event.transportToNext.duration}
                          </div>
                        )}
                        
                        {event.transportToNext.mode === 'TRANSIT' && (event.transportToNext.fromStation || event.locationName) && (
                          <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-slate-200/50">
                            <a 
                              href={`https://world.jorudan.co.jp/mln/zh-tw/?p=0&from=${encodeURIComponent(event.transportToNext.fromStation || event.locationName)}&to=${encodeURIComponent(event.transportToNext.toStation || (day.events[index + 1]?.locationName || ''))}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center gap-1 bg-orange-50 text-orange-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-orange-100 transition-colors"
                            >
                              <Train size={10} /> Japan Transit
                            </a>
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(event.transportToNext.fromStation || event.locationName)}&destination=${encodeURIComponent(event.transportToNext.toStation || (day.events[index + 1]?.locationName || ''))}&travelmode=transit`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors"
                            >
                              <MapIcon size={10} /> Google 路線
                            </a>
                          </div>
                        )}
                        
                        {/* Quick Actions (Hover/Focus) */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/transport:opacity-100 transition-opacity bg-white/80 rounded-full p-0.5 backdrop-blur-sm">
                          <button onClick={(e) => { e.stopPropagation(); startEditingTransport(event); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-full" title="編輯">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); removeTransport(event); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-full" title="刪除">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : !isEditing && (
                    <div className="ml-[18px] mt-2 mb-2 relative z-10 pl-[34px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEditingTransport(event, true)} 
                        className="text-[10px] font-bold text-slate-400 hover:text-blue-500 flex items-center gap-1.5 bg-white border border-dashed border-slate-300 hover:border-blue-300 px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-all"
                      >
                        <PlusCircle size={12} /> 新增交通方式
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Event Button Mobile */}
            <div className="flex items-center gap-4 relative z-10 pt-2 ml-1">
              <div className="w-[42px] flex justify-center shrink-0">
                <button 
                  onClick={onAddEvent}
                  className="w-10 h-10 rounded-full bg-white border-2 border-dashed border-blue-300 flex items-center justify-center text-blue-500 active:bg-blue-50 transition-all shadow-sm"
                >
                  <PlusCircle size={20} />
                </button>
              </div>
              <div 
                onClick={onAddEvent}
                className="flex-1 border-2 border-dashed border-slate-200 bg-white/50 rounded-2xl p-4 flex items-center justify-center text-slate-500 cursor-pointer active:bg-slate-50 transition-all font-bold text-sm"
              >
                新增下一個行程
              </div>
            </div>
          </div>
        ) : (
          /* ================================== */
          /* NOTES VIEW                         */
          /* ================================== */
          <div className="h-full flex flex-col animate-in fade-in duration-200">
            <div className="bg-white flex-1 rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1 text-slate-700">
                <FileText size={18} className="text-blue-500" />
                <h3 className="font-extrabold text-sm">今日隨手筆記</h3>
              </div>
              <textarea
                value={notesInput}
                onChange={handleNotesChange}
                placeholder="在這裡寫下今天的花費紀錄、必買清單、想記住的事情..."
                className="flex-1 w-full resize-none border-none focus:ring-0 p-1 text-[15px] leading-relaxed text-slate-600 bg-transparent"
                style={{ outline: 'none' }}
              />
              <div className="text-[11px] font-medium text-slate-400 mt-2 px-1 text-right">
                自動存檔中...
              </div>
            </div>
          </div>
        )}

        {/* ================================== */}
        {/* TRIP LINKS SECTION (Always Visible) */}
        {/* ================================== */}
        <div className="mt-8 mx-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center p-4 pb-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Globe size={18} className="text-indigo-500" />
                <h3 className="font-extrabold text-sm">常用網站與連結</h3>
              </div>
              <button 
                onClick={onAddTripLink}
                className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
              >
                <PlusCircle size={12}/> 新增
              </button>
            </div>

            <div className="flex flex-col gap-2 px-4 pb-4">
              {tripLinks.map(link => {
                const isEditing = editingTripLinkIds.has(link.id);
                return (
                <div key={link.id} className="group/link flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 relative hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                  <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg shrink-0">
                    <Link2 size={14} />
                  </div>
                  
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <input 
                        placeholder="網站名稱 (例: Visit Japan Web)"
                        value={link.title}
                        onChange={e => onUpdateTripLink(link.id, 'title', e.target.value)}
                        className="w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
                        autoFocus
                      />
                      <input 
                        placeholder="貼上網址 (https://...)"
                        value={link.url}
                        onChange={e => onUpdateTripLink(link.id, 'url', e.target.value)}
                        className="w-full text-[11px] text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
                      />
                      <div className="flex justify-end gap-1 mt-1">
                        <button 
                          onClick={() => stopEditingTripLink(link.id)}
                          className="px-2 py-1 text-[10px] font-bold text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                          完成
                        </button>
                      </div>
                    </div>
                  ) : (
                    <a 
                      href={link.url || '#'} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex-1 min-w-0"
                    >
                      <div className="text-sm font-bold text-slate-800 truncate">{link.title || '未命名'}</div>
                      <div className="text-[10px] text-slate-400 truncate">{link.url || '尚未設定網址'}</div>
                    </a>
                  )}
                  
                  <div className="flex items-center gap-1 shrink-0">
                    {!isEditing && (
                      <button 
                        onClick={() => startEditingTripLink(link.id)}
                        className="p-1.5 text-slate-300 hover:text-blue-500 rounded-full opacity-0 group-hover/link:opacity-100 transition-all"
                        title="編輯"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        stopEditingTripLink(link.id);
                        onDeleteTripLink(link.id);
                      }}
                      className="p-1.5 text-slate-300 hover:text-red-500 rounded-full opacity-0 group-hover/link:opacity-100 transition-all"
                      title="刪除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                );
              })}

              {tripLinks.length === 0 && (
                <div className="text-center text-slate-400 text-[11px] font-medium py-6 border-2 border-dashed border-slate-200 rounded-xl">
                  還沒有任何常用連結，點擊上方「新增」來加入吧！
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Use memo to prevent unnecessary re-renders
// Only re-render when day data or tripLinks actually change
export default memo(Timeline, (prev, next) => {
  // Re-render if day data changes
  if (prev.day?.id !== next.day?.id) return false;
  if (prev.day?.title !== next.day?.title) return false;
  if (prev.day?.date !== next.day?.date) return false;
  if (prev.day?.notes !== next.day?.notes) return false;
  if (prev.day?.events?.length !== next.day?.events?.length) return false;
  
  // Re-render if tripLinks change
  if (prev.tripLinks?.length !== next.tripLinks?.length) return false;
  
  return true;
});
