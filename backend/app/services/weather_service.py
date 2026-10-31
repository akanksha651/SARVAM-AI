import httpx


def get_weather_context(location: str | None) -> str:
    if not location:
        return "Weather unavailable: farmer location is not saved."

    try:
        with httpx.Client(timeout=12.0) as client:
            geo = client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": location, "count": 1, "language": "en"}
            )
            geo.raise_for_status()
            results = geo.json().get("results", [])

            if not results:
                return f"Weather unavailable: location {location} not found."

            place = results[0]

            response = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": place["latitude"],
                    "longitude": place["longitude"],
                    "current": (
                        "temperature_2m,relative_humidity_2m,"
                        "precipitation,rain,wind_speed_10m"
                    ),
                    "daily": (
                        "temperature_2m_max,temperature_2m_min,"
                        "precipitation_probability_max,precipitation_sum"
                    ),
                    "forecast_days": 3,
                    "timezone": "auto"
                }
            )
            response.raise_for_status()
            data = response.json()

        current = data.get("current", {})
        daily = data.get("daily", {})

        return (
            f"Verified weather data for {place.get('name', location)}: "
            f"Temperature: {current.get('temperature_2m')} C; "
            f"Humidity: {current.get('relative_humidity_2m')}%; "
            f"Precipitation: {current.get('precipitation')} mm; "
            f"Rain: {current.get('rain')} mm; "
            f"Wind: {current.get('wind_speed_10m')} km/h. "
            f"Three-day forecast: {daily}. "
            "This is location-level forecast data, not a field measurement."
        )

    except Exception as error:
        print("WEATHER SERVICE ERROR:", type(error).__name__)
        return "Live weather unavailable. Do not assume current weather conditions."
