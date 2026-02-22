import React, { useState } from "react";
import config from "./constants/config";

function UploadPage() {
  const [files, setFiles] = useState([]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    try {
      const res = await fetch(`${config.API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      alert("Upload failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Upload Room Images</h2>
      <input type="file" multiple accept="image/*" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading || !files.length} style={{ marginLeft: 8 }}>
        {loading ? "Uploading..." : "Upload"}
      </button>
      {response && (
        <div style={{ marginTop: 24 }}>
          <h3>Room Data</h3>
          <table border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Room No</th>
                <th>Room Type</th>
                <th>Position</th>
                <th>Dimensions</th>
                <th>Room Color</th>
                <th>Furniture Count</th>
                <th>Furniture</th>
              </tr>
            </thead>
            <tbody>
              {response.map((room) => (
                <tr key={room.roomno}>
                  <td>{room.roomno}</td>
                  <td>{room.roomtype}</td>
                  <td>{room.position.join(", ")}</td>
                  <td>{`Breadth: ${room.dimensions.breadth}, Length: ${room.dimensions.length}`}</td>
                  <td>
                    <span style={{ background: room.room_color, padding: "0 12px" }}>{room.room_color}</span>
                  </td>
                  <td>{room.furniture_count}</td>
                  <td>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {room.furniture.map((f, idx) => (
                        <li key={idx}>{`${f.type} (${f.position.join(", ")})`}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
