"use client";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function AttendPage() {
  const { token } = useParams();
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("http://localhost:5000/attend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, surname, ip: "" }),
    });
    if (res.ok) {
      setSubmitted(true);
    } else {
      setError("Attendance submission failed.");
    }
  };

  if (submitted) {
    return <div className="p-8 text-green-600">Attendance submitted. Thank you!</div>;
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Attendance Form</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="Surname"
          value={surname}
          onChange={e => setSurname(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Submit Attendance</button>
        {error && <div className="text-red-600">{error}</div>}
      </form>
    </main>
  );
} 