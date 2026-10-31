import json
from urllib.parse import urlencode
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

def get_air_quality(latitude: float, longitude: float):
    if not -90 <= latitude <= 90:
        raise ValueError("Invalid latitude")
    if not -180 <= longitude <= 180:
        raise ValueError("Invalid longitude")

    params = urlencode({
        "latitude": latitude,
        "longitude": longitude,
        "current": "european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
        "timezone": "auto"
    })

    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?{params}"

    try:
        with urlopen(url, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, HTTPError, TimeoutError) as error:
        raise ValueError("Air quality service is temporarily unavailable") from error

    current = payload.get("current")
    if not current:
        raise ValueError("Live air quality data is unavailable for this location")

    aqi = current.get("us_aqi")
    if aqi is None:
        category = "Unavailable"
    elif aqi <= 50:
        category = "Good"
    elif aqi <= 100:
        category = "Moderate"
    elif aqi <= 150:
        category = "Unhealthy for sensitive groups"
    elif aqi <= 200:
        category = "Unhealthy"
    elif aqi <= 300:
        category = "Very unhealthy"
    else:
        category = "Hazardous"

    return {
        "success": True,
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "timezone": payload.get("timezone")
        },
        "current": current,
        "us_aqi_category": category,
        "source": "Open-Meteo Air Quality API"
    }
