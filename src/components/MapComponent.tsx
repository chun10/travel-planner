"use client";

import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { ItineraryDay } from '../lib/types';
import { Layers, Maximize, Target } from 'lucide-react';

interface MapComponentProps {
  day: ItineraryDay;
  apiKey?: string; // Optional: If not provided, will show placeholder
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

export default function MapComponent({ day, apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '' }: MapComponentProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    language: 'zh-TW',
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    // Fit bounds to show all markers for the day
    if (day.events.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      day.events.forEach(event => bounds.extend(event.coordinates));
      map.fitBounds(bounds);
      
      // Prevent zooming in too far if there's only one point
      const listener = window.google.maps.event.addListener(map, "idle", function() { 
        if (map.getZoom() && map.getZoom()! > 16) map.setZoom(16); 
        window.google.maps.event.removeListener(listener); 
      });
    }
    mapRef.current = map;
  }, [day.events]);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    mapRef.current = null;
  }, []);

  const handleRecenter = () => {
    if (mapRef.current && day.events.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      day.events.forEach(event => bounds.extend(event.coordinates));
      mapRef.current.fitBounds(bounds);
    }
  };

  // Create path for Polyline
  const path = day.events.map(event => event.coordinates);

  if (!apiKey) {
    return (
      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-8 text-center border-l border-slate-200">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-sm">
          <Layers size={48} className="text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">請設定 Google Maps API Key</h3>
          <p className="text-slate-500 text-sm mb-4">
            為了顯示當日行程地點與地圖路線，請在環境變數中設定 <code className="bg-slate-100 px-1 py-0.5 rounded text-pink-600">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
          </p>
          <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg text-left">
            <strong>預計顯示功能：</strong>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              <li>{day.events.length} 個行程標記點</li>
              <li>點對點的交通路線 (地鐵搭乘/步行)</li>
              <li>當日行程總覽</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) return <div>地圖載入錯誤</div>;

  return isLoaded ? (
    <div className="w-full h-full relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={day.events.length > 0 ? day.events[0].coordinates : { lat: 25.0330, lng: 121.5654 }}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        {/* Render Markers */}
        {day.events.map((event, index) => (
          <Marker
            key={event.id}
            position={event.coordinates}
            label={{
              text: (index + 1).toString(),
              color: 'white',
              fontWeight: 'bold',
            }}
            title={event.locationName}
          />
        ))}

        {/* Render Route Polyline */}
        {path.length > 1 && (
          <Polyline
            path={path}
            options={{
              strokeColor: '#3b82f6', // blue-500
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
        )}
      </GoogleMap>
      
      {/* Map Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 shadow-lg rounded-lg bg-white overflow-hidden">
        <button 
          onClick={handleRecenter}
          className="p-3 hover:bg-slate-50 text-slate-600 border-b border-slate-100 transition-colors"
          title="重新置中"
        >
          <Target size={20} />
        </button>
        <button 
          className="p-3 hover:bg-slate-50 text-slate-600 transition-colors"
          title="全螢幕"
        >
          <Maximize size={20} />
        </button>
      </div>

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-200 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
        <span className="text-sm font-bold text-slate-700">第 {day.id.replace('day-', '')} 天行程路線</span>
      </div>
    </div>
  ) : <div className="w-full h-full bg-slate-50 animate-pulse flex items-center justify-center text-slate-400">載入地圖中...</div>;
}
