import React, { useState } from 'react';
import ThreeDView from '../ThreeDView';

export default function ThreeDViewRoute() {
  const [rooms, setRooms] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(Array.from(files));
    setError('');
    setLoading(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        setRooms([]);
        setError('Upload failed: ' + res.status);
        return;
      }
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      setRooms([]);
      setError('Error uploading images: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: Upload ── */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Upload Room Images</h2>
          <p className="text-xs text-gray-500 mt-1">Select one or more photos to generate a 3D view</p>
        </div>

        {/* Upload area */}
        <div className="p-6 flex flex-col gap-5 flex-1">
          <label className="cursor-pointer block">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/40 transition-all duration-200 group">
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-600">
                Click to choose files
              </p>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG — multiple allowed</p>
            </div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </label>

          {loading && (
            <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating 3D view…
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Preview thumbnails */}
          {selectedFiles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Selected ({selectedFiles.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden aspect-square bg-gray-100 border border-gray-200">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1.5 py-1">
                      <p className="text-white text-[10px] truncate">{file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-auto">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">💡 Tips</p>
              <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
                <li>Drag furniture to rearrange</li>
                <li>Double-click to rotate items</li>
                <li>Scroll to zoom in/out</li>
                <li>Click + drag background to orbit</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: 3D View ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 min-w-0">
        <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">3D Room View</h2>
            {rooms.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {rooms.length} room{rooms.length !== 1 ? 's' : ''} loaded — interact with the model below
              </p>
            )}
          </div>
          {rooms.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Live
            </span>
          )}
        </div>

        {/* Viewer area */}
        <div className="flex-1 relative overflow-hidden">
          {rooms.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="text-6xl mb-4 opacity-30">🧊</div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No rooms loaded yet</h3>
              <p className="text-sm text-gray-400 max-w-xs">
                Upload one or more room images using the panel on the left to generate an interactive 3D view.
              </p>
            </div>
          ) : (
            <ThreeDView rooms={rooms} />
          )}
        </div>
      </div>
    </div>
  );
}