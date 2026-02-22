import React, { useState } from 'react';

async function callReplicateAPI({ image, theme, room }) {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    const response = await fetch(`${apiUrl}/replicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, theme, room }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API Error');
    return data.output;
  } catch (error) {
    console.error('Replicate API error:', error);
    return null;
  }
}

const THEMES = ['Modern', 'Classic', 'Minimalist', 'Bohemian', 'Industrial', 'Scandinavian', 'Art Deco', 'Rustic'];
const ROOMS = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office', 'Dining Room', 'Hallway'];

export default function ReplicatePage() {
  const [image, setImage] = useState('');
  const [theme, setTheme] = useState('Modern');
  const [room, setRoom] = useState('Living Room');
  const [output, setOutput] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    reader.onerror = () => setError('Failed to read file');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) return;
    setLoading(true);
    setError('');
    setOutput([]);
    const result = await callReplicateAPI({ image, theme, room });
    if (result) {
      setOutput(result);
    } else {
      setError('Failed to get output from API. Please try again.');
    }
    setLoading(false);
  };

  const hasImage = !!image;
  const hasOutput = output.length > 0;

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-900">Replicate Room</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a photo of your room and let AI reimagine it with a new design style
        </p>
      </div>

      <div className="flex-1 p-8 flex flex-col gap-6 max-w-5xl w-full mx-auto">

        {/* ── Controls Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

              {/* Design Theme */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Design Theme
                </label>
                <div className="flex flex-wrap gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150
                        ${theme === t
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  placeholder="Or type a custom theme…"
                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                />
              </div>

              {/* Room Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Room Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROOMS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoom(r)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150
                        ${room === r
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  placeholder="Or type a custom room…"
                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>

              {/* Upload Photo */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Upload Photo
                </label>
                <label className="cursor-pointer block">
                  <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-all duration-200 group
                    ${hasImage ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-purple-300 hover:bg-purple-50/30'}`}>
                    <div className="text-2xl mb-1">{hasImage ? '✅' : '📷'}</div>
                    <p className="text-xs font-semibold text-gray-600 group-hover:text-purple-600 transition-colors">
                      {fileName || 'Click to upload photo'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">JPEG / PNG, max 5 MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-4 pt-1">
              <button
                type="submit"
                disabled={loading || !hasImage}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm
                  ${loading || !hasImage
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105 active:scale-100'
                  }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Design
                  </>
                )}
              </button>
              {!hasImage && (
                <p className="text-xs text-gray-400">Upload a photo to get started</p>
              )}
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm text-red-600 font-medium flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ── Before / After ── */}
        <div className="grid grid-cols-2 gap-5">
          {/* Original */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Original Photo</span>
              {hasImage && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Uploaded</span>
              )}
            </div>
            <div className="p-5 min-h-56 flex items-center justify-center bg-gray-50">
              {hasImage ? (
                <img
                  src={image}
                  alt="original"
                  className="max-w-full max-h-72 rounded-xl object-contain shadow-sm"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <div className="text-5xl mb-3 opacity-30">📷</div>
                  <p className="text-sm font-medium">No image uploaded</p>
                  <p className="text-xs mt-1 opacity-70">Upload a photo using the panel above</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Output */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">AI Design</span>
              {hasOutput && (
                <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  ✓ Generated
                </span>
              )}
              {loading && (
                <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                  Generating…
                </span>
              )}
            </div>
            <div className="p-5 min-h-56 flex items-center justify-center bg-gray-50">
              {loading ? (
                <div className="text-center text-gray-400">
                  <div className="flex justify-center mb-3">
                    <svg className="animate-spin w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-purple-500">AI is reimagining your room…</p>
                  <p className="text-xs mt-1 text-gray-400">This may take 15–30 seconds</p>
                </div>
              ) : hasOutput ? (
                <img
                  src={output[1] || output[0]}
                  alt="ai-design"
                  className="max-w-full max-h-72 rounded-xl object-contain shadow-sm"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <div className="text-5xl mb-3 opacity-30">🎨</div>
                  <p className="text-sm font-medium">Your AI design will appear here</p>
                  <p className="text-xs mt-1 opacity-70">Select a theme, room type, and upload a photo</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download button */}
        {hasOutput && (
          <div className="flex justify-center">
            <a
              href={output[1] || output[0]}
              download="roomify-ai-design.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Design
            </a>
          </div>
        )}
      </div>
    </div>
  );
}