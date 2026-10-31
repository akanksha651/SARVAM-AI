const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function checkBackend() {
  const response = await fetch(`${API_URL}/health`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Backend connection failed");
  }

  return response.json();
}

export async function getModules() {
  const response = await fetch(`${API_URL}/api/modules`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not fetch modules");
  }

  return response.json();
}

export async function sendMessage(message: string) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "AI request failed");
  }

  return response.json();
}

export async function sendAgricultureMessage(
  message: string,
  conversationId: string | null
) {
  const response = await fetch(`${API_URL}/api/agriculture/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Agriculture AI request failed");
  }

  return response.json();
}

export async function sendAgricultureImage(
  image: File,
  message = "",
  conversationId: string | null = null
) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("message", message);

  if (conversationId) {
    formData.append("conversation_id", conversationId);
  }

  const response = await fetch(`${API_URL}/api/agriculture/analyze-image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Image analysis failed");
  }

  return response.json();
}



export async function getAgricultureHistory(conversationId: string) {
  const response = await fetch(
    `${API_URL}/api/agriculture/history/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not restore conversation");
  }

  return response.json();
}


export async function getAgricultureProfile(conversationId: string) {
  const response = await fetch(
    `${API_URL}/api/agriculture/profile/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not fetch farmer profile");
  }

  return response.json();
}


export async function getAgricultureWeather(conversationId: string) {
  const response = await fetch(
    `${API_URL}/api/agriculture/weather/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not fetch farm weather");
  }

  return response.json();
}

export type FarmAction = {
  id: string;
  conversation_id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateFarmActionRequest = {
  title: string;
  description?: string;
  due_date?: string | null;
};

export type UpdateFarmActionRequest = {
  conversation_id: string;
  status?: "pending" | "in_progress" | "completed";
  description?: string;
};

export async function getFarmActions(
  conversationId: string
): Promise<FarmAction[]> {
  const response = await fetch(
    `${API_URL}/api/agriculture/actions/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not fetch farm tasks");
  }

  const data = await response.json();
  return data.actions;
}

export async function createFarmAction(
  conversationId: string,
  task: CreateFarmActionRequest
): Promise<FarmAction> {
  const response = await fetch(
    `${API_URL}/api/agriculture/actions/${encodeURIComponent(conversationId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not create farm task");
  }

  const data = await response.json();
  return data.action;
}

export async function updateFarmAction(
  actionId: string,
  update: UpdateFarmActionRequest
): Promise<FarmAction> {
  const response = await fetch(
    `${API_URL}/api/agriculture/actions/${encodeURIComponent(actionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not update farm task");
  }

  const data = await response.json();
  return data.action;
}


export type AgricultureRecommendation = {
  id: string;
  conversation_id: string;
  recommendation: string;
  source: "chat" | "image";
  status: "saved" | "approved" | "converted";
  linked_action_id: string | null;
  created_at: string;
  approved_at: string | null;
  converted_at: string | null;
};

export async function getAgricultureRecommendations(
  conversationId: string
): Promise<AgricultureRecommendation[]> {
  const response = await fetch(
    `${API_URL}/api/agriculture/recommendations/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not fetch recommendations");
  }

  const data = await response.json();
  return data.recommendations;
}

export async function saveAgricultureRecommendation(
  conversationId: string,
  recommendation: string,
  source: "chat" | "image" = "chat"
): Promise<AgricultureRecommendation> {
  const response = await fetch(
    `${API_URL}/api/agriculture/recommendations/${encodeURIComponent(conversationId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation, source }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not save recommendation");
  }

  const data = await response.json();
  return data.recommendation;
}

export async function approveAgricultureRecommendation(
  recommendationId: string,
  conversationId: string
): Promise<AgricultureRecommendation> {
  const response = await fetch(
    `${API_URL}/api/agriculture/recommendations/${encodeURIComponent(recommendationId)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not approve recommendation");
  }

  const data = await response.json();
  return data.recommendation;
}

export async function convertAgricultureRecommendation(
  recommendationId: string,
  conversationId: string,
  title: string,
  dueDate?: string
) {
  const response = await fetch(
    `${API_URL}/api/agriculture/recommendations/${encodeURIComponent(recommendationId)}/convert`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        title,
        due_date: dueDate || null,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not convert recommendation");
  }

  return response.json();
}

// EDUCATION MODULE

export type EducationMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type StudentProfile = {
  [key: string]: unknown;
};

export type EducationChatResponse = {
  success: boolean;
  conversation_id: string;
  reply: string;
  model: string;
  status: string;
};

export async function sendEducationMessage(
  message: string,
  conversationId: string | null
): Promise<EducationChatResponse> {
  const response = await fetch(`${API_URL}/api/education/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Education AI request failed");
  }

  return response.json();
}

export async function getEducationHistory(
  conversationId: string
): Promise<EducationMessage[]> {
  const response = await fetch(
    `${API_URL}/api/education/history/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not restore education conversation");
  }

  const data = await response.json();
  return data.messages;
}

export async function getStudentProfile(
  conversationId: string
): Promise<StudentProfile> {
  const response = await fetch(
    `${API_URL}/api/education/profile/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not fetch student profile");
  }

  const data = await response.json();
  return data.profile;
}

export async function updateStudentProfile(
  conversationId: string,
  profile: StudentProfile
): Promise<StudentProfile> {
  const response = await fetch(
    `${API_URL}/api/education/profile/${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Could not update student profile");
  }

  const data = await response.json();
  return data.profile;
}


export async function calculateFinanceEMI(payload: {
  principal: number;
  annual_rate: number;
  months: number;
}) {
  const response = await fetch(`${API_URL}/api/finance/emi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "EMI calculation failed");
  return data;
}

export async function analyzeFinanceBudget(payload: {
  income: number;
  expenses: Record<string, number>;
}) {
  const response = await fetch(`${API_URL}/api/finance/budget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Budget analysis failed");
  return data;
}

export async function calculateFinanceSavingsGoal(payload: {
  target_amount: number;
  current_savings: number;
  months: number;
}) {
  const response = await fetch(`${API_URL}/api/finance/savings-goal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Savings calculation failed");
  return data;
}

export async function getModuleRecords(module: string, workspaceId: string) {
  const response = await fetch(
    `${API_URL}/api/${module}/records?workspace_id=${encodeURIComponent(workspaceId)}`,
    { cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not load records");
  return data;
}

export async function createModuleRecord(
  module: string,
  payload: { workspace_id: string; title: string; data: Record<string, string> }
) {
  const response = await fetch(`${API_URL}/api/${module}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not save record");
  return data;
}

export async function updateModuleRecord(
  module: string,
  recordId: string,
  payload: { workspace_id: string; title: string; data: Record<string, unknown> }
) {
  const response = await fetch(`${API_URL}/api/${module}/records/${encodeURIComponent(recordId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not update record");
  return data;
}

export async function deleteModuleRecord(
  module: string,
  recordId: string,
  workspaceId: string
) {
  const response = await fetch(
    `${API_URL}/api/${module}/records/${encodeURIComponent(recordId)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not delete record");
  return data;
}

export async function getLiveAirQuality(latitude: number, longitude: number) {
  const response = await fetch(`${API_URL}/api/environment/air-quality`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Air quality lookup failed");
  return data;
}

export async function sendHealthcareMessage(
  message: string,
  conversationId: string | null,
  healthContext: Array<{
    title: string;
    data: Record<string, string>;
    created_at: string;
  }> = []
) {
  const response = await fetch(`${API_URL}/api/healthcare/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      health_context: healthContext,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Healthcare AI request failed");
  return data;
}

export async function getHealthcareHistory(conversationId: string) {
  const response = await fetch(
    `${API_URL}/api/healthcare/history/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not load healthcare history");
  return data;
}
export async function sendGovernmentAssistantMessage(
  message: string,
  applicationContext: Array<{ title: string; created_at: string; data: Record<string, string> }> = [],
  conversationId: string | null = null
) {
  const response = await fetch(`${API_URL}/api/government/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conversationId, application_context: applicationContext }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Government AI request failed");
  return data as { success: boolean; conversation_id: string; reply: string; model: string; status: string };
}

export async function getGovernmentHistory(conversationId: string) {
  const response = await fetch(
    `${API_URL}/api/government/history/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not load government history");
  return data as { conversation_id: string; messages: Array<{ role: "user" | "assistant"; content: string; created_at: string }>; status: string };
}

export async function sendEnvironmentAssistantMessage(
  message: string,
  environmentContext: Array<{ title: string; created_at: string; data: Record<string, string> }> = [],
  conversationId: string | null = null
) {
  const response = await fetch(`${API_URL}/api/environment/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conversationId, environment_context: environmentContext }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Environment AI request failed");
  return data as { success: boolean; conversation_id: string; reply: string; model: string; status: string };
}

export async function getEnvironmentHistory(conversationId: string) {
  const response = await fetch(
    `${API_URL}/api/environment/history/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not load environment history");
  return data as { conversation_id: string; messages: Array<{ role: "user" | "assistant"; content: string; created_at: string }>; status: string };
}
