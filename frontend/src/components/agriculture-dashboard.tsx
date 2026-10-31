"use client";

import { useEffect, useState } from "react";
import AgricultureWeather from "@/components/agriculture-weather";
import FarmTaskTracker from "@/components/farm-task-tracker";
import RecommendationHistory from "@/components/recommendation-history";
import FarmerProfile from "@/components/farmer-profile";
import AgricultureAIChat from "@/components/agriculture-ai-chat";

export default function AgricultureDashboard() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setConversationId(
      localStorage.getItem("sarvam_agriculture_conversation_id")
    );
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-green-800 to-emerald-600 p-7 text-white">
        <p className="text-sm text-green-100">SARVAM AI / Agriculture</p>
        <h1 className="mt-2 text-3xl font-bold">Smart Agriculture Dashboard</h1>
        <p className="mt-2 text-sm text-green-50">
          Farming insights, weather, crop recommendations and farm task management.
        </p>
      </section>

      <AgricultureAIChat onActivityUpdated={() => setRefreshKey((key) => key + 1)} />
      <FarmerProfile conversationId={conversationId} refreshToken={refreshKey} />
      <AgricultureWeather conversationId={conversationId} />
      <FarmTaskTracker conversationId={conversationId} refreshToken={refreshKey} />
      <RecommendationHistory
        conversationId={conversationId}
        refreshToken={refreshKey}
        onTaskCreated={() => setRefreshKey((key) => key + 1)}
      />
    </div>
  );
}
