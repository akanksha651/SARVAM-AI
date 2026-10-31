"use client";

type Props = {
  aqiData: any;
};

function getGuidance(aqi: number) {
  if (aqi <= 50) {
    return {
      category: "Good",
      description: "Air quality is generally satisfactory.",
      actions: [
        "Normal outdoor activities are generally suitable.",
        "Continue regular ventilation and everyday precautions.",
      ],
    };
  }

  if (aqi <= 100) {
    return {
      category: "Moderate",
      description: "Air quality is acceptable for most people.",
      actions: [
        "Most people can continue normal outdoor activities.",
        "Unusually sensitive people should consider reducing prolonged heavy outdoor exertion if they experience discomfort.",
      ],
    };
  }

  if (aqi <= 150) {
    return {
      category: "Unhealthy for Sensitive Groups",
      description: "Sensitive groups may experience health effects.",
      actions: [
        "Children, older adults and people with heart or lung conditions should reduce prolonged heavy outdoor exertion.",
        "Consider moving strenuous activities indoors when practical.",
      ],
    };
  }

  if (aqi <= 200) {
    return {
      category: "Unhealthy",
      description: "Some members of the general public may experience health effects.",
      actions: [
        "Reduce prolonged or heavy outdoor exertion.",
        "Sensitive groups should avoid strenuous outdoor activity.",
        "Follow local public-health advisories.",
      ],
    };
  }

  if (aqi <= 300) {
    return {
      category: "Very Unhealthy",
      description: "Health alert: the risk of health effects is increased.",
      actions: [
        "Avoid strenuous outdoor activities.",
        "Keep outdoor exposure as short as practical.",
        "Follow official local health and air-quality advisories.",
      ],
    };
  }

  return {
    category: "Hazardous",
    description: "Health warning: everyone may experience more serious effects.",
    actions: [
      "Avoid outdoor physical exertion.",
      "Stay indoors in cleaner air where possible.",
      "Follow emergency and public-health instructions from local authorities.",
    ],
  };
}

export default function EnvironmentAqiGuidance({ aqiData }: Props) {
  const rawValue = aqiData?.current?.us_aqi ?? aqiData?.us_aqi;
  const aqi = Number(rawValue);

  if (rawValue === null || rawValue === undefined ||
      rawValue === "" || !Number.isFinite(aqi) || aqi < 0) {
    return null;
  }

  const guidance = getGuidance(aqi);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="text-sm text-muted-foreground">AQI-based guidance</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold">{guidance.category}</h3>
          <span className="rounded-full border px-3 py-1 text-sm font-semibold">
            US AQI: {aqi}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {guidance.description}
        </p>
      </div>

      <div>
        <h4 className="mb-2 font-medium">Recommended precautions</h4>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {guidance.actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        General guidance based on US AQI categories. It is not a medical
        assessment. Follow official local advisories. AQI readings can change
        over time and may differ by measurement scale.
      </p>
    </section>
  );
}