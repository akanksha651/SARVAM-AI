
"use client";

import { useEffect, useState } from "react";
import { getAgricultureWeather } from "@/lib/api";

type WeatherData = {
  location?: { name?: string; admin1?: string; country?: string };
  current?: Record<string, number | string>;
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
  };
};

export default function AgricultureWeather({
  conversationId,
}: {
  conversationId: string | null;
}) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setData(null);
      setError("");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    getAgricultureWeather(conversationId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message || "Weather unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [conversationId]);

  if (!conversationId) return null;

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">?? Farm Weather</h3>
        <span className="text-xs text-slate-500">Live provider data</span>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading weather...</p>}
      {error && <p className="text-sm text-amber-700">{error}</p>}

      {data?.current && (
        <>
          <p className="mb-3 text-sm text-slate-600">
            {data.location?.name}, {data.location?.admin1}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Temperature", `${data.current.temperature_2m ?? "--"} ?C`],
              ["Humidity", `${data.current.relative_humidity_2m ?? "--"} %`],
              ["Rain", `${data.current.precipitation ?? "--"} mm`],
              ["Wind", `${data.current.wind_speed_10m ?? "--"} km/h`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <h4 className="mb-2 mt-4 text-sm font-semibold">3-day forecast</h4>
          <div className="grid grid-cols-3 gap-2">
            {data.daily?.time?.map((date, index) => (
              <div key={date} className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs text-slate-500">{date}</p>
                <p className="mt-1 text-sm font-semibold">
                  {data.daily?.temperature_2m_max?.[index] ?? "--"}? /
                  {data.daily?.temperature_2m_min?.[index] ?? "--"}?
                </p>
                <p className="text-xs text-slate-600">
                  Rain chance: {data.daily?.precipitation_probability_max?.[index] ?? "--"}%
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Source: Open-Meteo. Forecast is location-based, not a field-level measurement.
          </p>
        </>
      )}
    </section>
  );
}
