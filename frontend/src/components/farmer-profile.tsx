
"use client";

import { useEffect, useState } from "react";
import { getAgricultureProfile } from "@/lib/api";

type Profile = {
  crop?: string;
  location?: string;
  crop_age?: string;
  growth_stage?: string;
  symptoms?: string;
  irrigation?: string;
  fertilizer?: string;
};

export default function FarmerProfile({
  conversationId,
  refreshToken,
}: {
  conversationId: string | null;
  refreshToken: number;
}) {
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setProfile({});
      return;
    }

    let active = true;
    setLoading(true);

    getAgricultureProfile(conversationId)
      .then((result) => {
        if (active) setProfile(result.profile || {});
      })
      .catch(() => {
        if (active) setProfile({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [conversationId, refreshToken]);

  const fields = [
    ["Crop", profile.crop],
    ["Location", profile.location],
    ["Crop age", profile.crop_age],
    ["Growth stage", profile.growth_stage],
    ["Symptoms", profile.symptoms],
    ["Irrigation", profile.irrigation],
    ["Fertilizer history", profile.fertilizer],
  ].filter((item) => item[1]);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">?? Farmer Profile</h3>
        <span className="text-xs text-muted-foreground">
          {loading ? "Updating..." : "Saved farm details"}
        </span>
      </div>

      {!conversationId || fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Share your crop and farm details in the chat to build your profile.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 break-words text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
