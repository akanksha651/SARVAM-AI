import re
from pathlib import Path
from app.services.agriculture_memory import (
    get_connection,
    initialize_memory,
)

def initialize_profiles():
    initialize_memory()
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS farmer_profiles (
                conversation_id TEXT PRIMARY KEY,
                crop TEXT,
                location TEXT,
                crop_age TEXT,
                growth_stage TEXT,
                symptoms TEXT,
                irrigation TEXT,
                fertilizer TEXT,
                updated_at TEXT,
                FOREIGN KEY(conversation_id)
                    REFERENCES conversations(id)
            )
        """)


def extract_farm_details(message):
    text = message.strip()
    lower = text.lower()
    details = {}

    crop_aliases = {
        "tomatoes": "Tomato", "tomato": "Tomato",
        "wheat": "Wheat", "rice": "Rice", "paddy": "Rice",
        "potatoes": "Potato", "potato": "Potato",
        "onions": "Onion", "onion": "Onion",
        "maize": "Maize", "corn": "Maize",
        "sugarcane": "Sugarcane", "cotton": "Cotton",
        "soybean": "Soybean", "mustard": "Mustard",
        "chilli": "Chilli", "chili": "Chilli",
        "brinjal": "Brinjal", "eggplant": "Brinjal"
    }

    for alias, canonical in crop_aliases.items():
        if re.search(r"\\b" + re.escape(alias) + r"\\b", lower):
            details["crop"] = canonical
            break

    location_patterns = [
        r"\b(?:in|at|near|from)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})",
        r"\b(?:location|district|city)\s*[:=]\s*([A-Za-z ]+)"
    ]

    for pattern in location_patterns:
        match = re.search(pattern, text)
        if match:
            location = match.group(1).strip()
            if location.lower() not in crops:
                details["location"] = location
                break

    age_patterns = [
        r"\b(\d+\s*(?:days?|weeks?|months?)(?:\s+old)?)\b",
        r"\b(\d+\s*(?:din|hafte|mahine)(?:\s+ka|\s+ki)?)\b"
    ]

    for pattern in age_patterns:
        match = re.search(pattern, lower)
        if match:
            details["crop_age"] = match.group(1).strip()
            break

    stage_keywords = {
        "seedling": ["seedling", "nursery"],
        "vegetative": ["vegetative", "growing stage"],
        "flowering": ["flowering", "flowers"],
        "fruiting": ["fruiting", "fruit set"],
        "harvesting": ["harvesting", "harvest stage"]
    }

    for stage, keywords in stage_keywords.items():
        if any(word in lower for word in keywords):
            details["growth_stage"] = stage
            break

    symptom_keywords = [
        "yellow leaves", "yellowing", "spots", "wilting",
        "curling", "leaf curl", "holes", "stunted growth",
        "brown leaves", "dry leaves"
    ]

    found = [word for word in symptom_keywords if word in lower]
    if found:
        details["symptoms"] = ", ".join(found)

    irrigation_keywords = [
        "drip irrigation", "sprinkler", "furrow",
        "flood irrigation", "manual watering"
    ]

    found = [word for word in irrigation_keywords if word in lower]
    if found:
        details["irrigation"] = ", ".join(found)

    if any(word in lower for word in ["fertilizer", "urea", "dap", "npk", "compost"]):
        details["fertilizer"] = text[:500]

    return details


def update_farmer_profile(conversation_id, message):
    initialize_profiles()
    details = extract_farm_details(message)

    if not details:
        return

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    columns = [
        "crop", "location", "crop_age", "growth_stage",
        "symptoms", "irrigation", "fertilizer"
    ]

    with get_connection() as connection:
        connection.execute(
            "INSERT OR IGNORE INTO farmer_profiles (conversation_id) VALUES (?)",
            (conversation_id,)
        )

        for field in columns:
            if field in details:
                connection.execute(
                    f"UPDATE farmer_profiles SET {field} = ?, updated_at = ? WHERE conversation_id = ?",
                    (details[field], now, conversation_id)
                )


def get_farmer_profile(conversation_id):
    initialize_profiles()

    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM farmer_profiles WHERE conversation_id = ?",
            (conversation_id,)
        ).fetchone()

    if not row:
        return {}

    return {
        key: row[key]
        for key in [
            "crop", "location", "crop_age", "growth_stage",
            "symptoms", "irrigation", "fertilizer"
        ]
        if row[key]
    }
