from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel, Field
import base64
import re
from io import BytesIO
from PIL import Image
from groq import APIStatusError, APIConnectionError, RateLimitError

from app.services.ai_service import generate_response, client
from app.services.farmer_profile import update_farmer_profile, get_farmer_profile
from app.services.weather_service import get_weather_context
from app.services.agriculture_memory import (
    get_or_create_conversation,
    get_recent_messages,
    save_message,
    get_conversation_history,
)


from app.services.finance_service import (
    calculate_emi,
    calculate_budget,
    calculate_savings_goal,
)

from app.services.module_records import create_record, list_records, delete_record, update_record

from app.services.environment_service import get_air_quality

router = APIRouter()

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)

class ChatResponse(BaseModel):
    reply: str
    model: str
    status: str


class QuizGenerateRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=100)
    topic: str = Field(min_length=1, max_length=500)
    difficulty: str = Field(min_length=1, max_length=50)
    count: int = Field(default=5, ge=1, le=20)


class QuizSubmitRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=100)
    answers: dict[str, str]

MODULES = [
    {
        "id": "agriculture",
        "name": "Agriculture",
        "description": "AI assistance for farming, crops and agricultural problems.",
        "status": "active"
    },
    {
        "id": "education",
        "name": "Education",
        "description": "Personalized learning and educational assistance.",
        "status": "active"
    },
    {
        "id": "healthcare",
        "name": "Healthcare",
        "description": "Medical document understanding and appointment preparation.",
        "status": "active"
    },
    {
        "id": "finance",
        "name": "Finance",
        "description": "Budgeting, expense tracking and financial planning.",
        "status": "active"
    },
    {
        "id": "government",
        "name": "Government Services",
        "description": "Government schemes and eligibility information.",
        "status": "active"
    },
    {
        "id": "environment",
        "name": "Environment",
        "description": "Environmental information and problem reporting.",
        "status": "active"
    }
]

@router.get("/modules")
async def get_modules():
    return {
        "total": len(MODULES),
        "modules": MODULES
    }

@router.get("/status")
async def get_api_status():
    return {
        "status": "operational",
        "service": "SARVAM AI API"
    }

@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        reply = generate_response(request.message)

        return ChatResponse(
            reply=reply,
            model="openai/gpt-oss-20b",
            status="success"
        )

    except RateLimitError as error:
        raise HTTPException(
            status_code=429,
            detail="AI usage limit reached. Please try again later."
        ) from error

    except APIConnectionError as error:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the AI provider."
        ) from error

    except APIStatusError as error:
        print(
            "AGRICULTURE PROVIDER ERROR:",
            "status=", error.status_code,
            "body=", str(getattr(error, "message", ""))[:2000],
            flush=True
        )
        raise HTTPException(
            status_code=502,
            detail=f"AI provider returned HTTP {error.status_code}: "
                   f"{str(getattr(error, 'message', 'Request failed'))[:500]}"
        ) from error

    except Exception as error:
        print("SARVAM AI ERROR:", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail="AI service is temporarily unavailable."
        ) from error


from app.agents.education_agent import solve_education_problem
from app.services.education_memory import (
    get_or_create_conversation as get_or_create_education_conversation,
    get_recent_messages as get_recent_education_messages,
    save_message as save_education_message,
    get_conversation_history as get_education_history,
    get_student_profile,
    update_student_profile,
)

class EducationRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: str | None = None


class StudentProfileRequest(BaseModel):
    profile: dict = Field(default_factory=dict)

def validate_student_profile(profile: dict) -> dict:
    if not isinstance(profile, dict):
        raise ValueError("Student profile must be an object.")

    limits = {
        "grade": 80,
        "subjects": 300,
        "learning_level": 20,
        "goals": 500,
    }

    unknown = set(profile) - set(limits)
    if unknown:
        raise ValueError(
            "Unsupported profile fields: " + ", ".join(sorted(unknown))
        )

    validated = {}

    for key, value in profile.items():
        if not isinstance(value, str):
            raise ValueError(f"{key} must be text.")

        value = value.strip()

        if len(value) > limits[key]:
            raise ValueError(
                f"{key} must not exceed {limits[key]} characters."
            )

        if key == "learning_level" and value:
            normalized = value.lower()
            allowed = {"beginner", "intermediate", "advanced"}
            if normalized not in allowed:
                raise ValueError(
                    "learning_level must be Beginner, Intermediate, or Advanced."
                )
            value = normalized

        validated[key] = value

    return validated



@router.post("/education/chat")
def education_chat(request: EducationRequest):
    try:
        conversation_id = get_or_create_education_conversation(
            request.conversation_id
        )

        history = get_recent_education_messages(conversation_id)
        student_profile = get_student_profile(conversation_id)

        reply = solve_education_problem(
            request.message,
            conversation_history=history,
            student_profile=student_profile
        )

        save_education_message(
            conversation_id, "user", request.message
        )
        save_education_message(
            conversation_id, "assistant", reply
        )

        return {
            "success": True,
            "conversation_id": conversation_id,
            "reply": reply,
            "model": "education-agent",
            "status": "success"
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RateLimitError as error:
        raise HTTPException(
            status_code=429,
            detail="AI usage limit reached. Please try again later."
        ) from error
    except APIConnectionError as error:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the AI provider."
        ) from error
    except APIStatusError as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI provider returned HTTP {error.status_code}."
        ) from error
    except Exception as error:
        print("EDUCATION CHAT ERROR:", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail="Education AI is temporarily unavailable."
        ) from error


@router.get("/education/history/{conversation_id}")
def education_history(conversation_id: str):
    try:
        messages = get_education_history(conversation_id)
        return {
            "success": True,
            "conversation_id": conversation_id,
            "total_messages": len(messages),
            "messages": messages
        }
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/education/profile/{conversation_id}")
def education_profile(conversation_id: str):
    try:
        get_education_history(conversation_id)
        return {
            "success": True,
            "conversation_id": conversation_id,
            "profile": get_student_profile(conversation_id)
        }
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.patch("/education/profile/{conversation_id}")
def edit_education_profile(
    conversation_id: str,
    request: StudentProfileRequest
):
    try:
        get_education_history(conversation_id)

        if not request.profile:
            raise HTTPException(
                status_code=400,
                detail="Student profile cannot be empty."
            )

        validated_profile = validate_student_profile(request.profile)

        profile = update_student_profile(
            conversation_id,
            validated_profile
        )

        return {
            "success": True,
            "conversation_id": conversation_id,
            "profile": profile
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

from app.agents.agriculture_agent import solve_agriculture_problem


class AgricultureRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: str | None = None


@router.post("/agriculture/chat")
def agriculture_chat(request: AgricultureRequest):
    try:
        conversation_id = get_or_create_conversation(
            request.conversation_id
        )
        history = get_recent_messages(conversation_id)

        update_farmer_profile(conversation_id, request.message)
        farmer_profile = get_farmer_profile(conversation_id)

        weather_context = get_weather_context(
            farmer_profile.get("location")
        )

        reply = solve_agriculture_problem(
            request.message,
            conversation_history=history,
            farmer_profile=farmer_profile,
            weather_context=weather_context
        )

        save_message(conversation_id, "user", request.message)
        save_message(conversation_id, "assistant", reply)

        return {
            "reply": reply,
            "agent": "agriculture",
            "model": "openai/gpt-oss-20b",
            "conversation_id": conversation_id,
            "status": "success"
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error

    except RateLimitError as error:
        raise HTTPException(
            status_code=429,
            detail="AI usage limit reached. Please try again later."
        ) from error

    except APIConnectionError as error:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the AI provider."
        ) from error

    except APIStatusError as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI provider returned HTTP {error.status_code}."
        ) from error

    except Exception as error:
        print("AGRICULTURE AGENT ERROR:", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail="Agriculture AI is temporarily unavailable."
        ) from error



def detect_farmer_language(message: str) -> str:
    text = message.lower().strip()

    # Devanagari input means Hindi output.
    if any("\u0900" <= char <= "\u097f" for char in message):
        return "Hindi in Devanagari script"

    hindi_words = {
        "hai", "hain", "tha", "thi", "the", "ka", "ki", "ke",
        "kya", "kyun", "kaise", "kab", "kahan", "mera", "meri",
        "mere", "mujhe", "aap", "apka", "batao", "bataye",
        "karo", "karna", "krna", "paudha", "paudhe", "tamatar",
        "fasal", "kheti", "paani", "pani", "mitti", "patta",
        "patte", "patton", "dikhao", "dikh", "nhi", "nahi",
        "aur", "isko", "iska", "chahiye", "ho", "raha", "rahe",
        "liye", "agar", "toh", "to", "abhi", "kaafi", "bahut"
    }

    words = set(re.findall(r"[a-z]+", text))
    hindi_count = len(words.intersection(hindi_words))

    if hindi_count >= 2:
        return "Natural Hinglish in Latin script (Hindi-English mix)"

    return "Natural English"



@router.get("/agriculture/history/{conversation_id}")
def agriculture_history(conversation_id: str):
    try:
        messages = get_conversation_history(conversation_id)
        return {
            "conversation_id": conversation_id,
            "messages": messages,
            "status": "success"
        }
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

@router.post("/agriculture/analyze-image")
async def agriculture_image_analysis(
    image: UploadFile = File(...),
    message: str = Form(default="", max_length=2000),
    conversation_id: str | None = Form(default=None)
):
    allowed_types = {
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/webp": "WEBP"
    }

    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG or WEBP image."
        )

    image_data = await image.read(8 * 1024 * 1024 + 1)

    if len(image_data) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image size must be less than 8 MB."
        )

    try:
        with Image.open(BytesIO(image_data)) as uploaded_image:
            if uploaded_image.format != allowed_types[image.content_type]:
                raise HTTPException(
                    status_code=400,
                    detail="Image content does not match its file type."
                )
            uploaded_image.verify()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image."
        ) from error

    # Optimize the image before sending it to the vision provider.
    # Preserve aspect ratio and avoid unnecessary upscaling.
    try:
        with Image.open(BytesIO(image_data)) as source_image:
            source_image.load()

            if source_image.width * source_image.height > 40_000_000:
                raise HTTPException(
                    status_code=413,
                    detail="Image resolution is too large. Please upload a lower-resolution image."
                )

            # Flatten transparent images onto a white background.
            if source_image.mode in ("RGBA", "LA") or (
                source_image.mode == "P" and "transparency" in source_image.info
            ):
                rgba = source_image.convert("RGBA")
                background = Image.new("RGB", rgba.size, (255, 255, 255))
                background.paste(rgba, mask=rgba.getchannel("A"))
                optimized_source = background
            else:
                optimized_source = source_image.convert("RGB")

            resampling = getattr(Image, "Resampling", Image).LANCZOS
            optimized_bytes = None

            # Reduce dimensions gradually only when needed.
            for max_dimension in (1600, 1400, 1200, 1000):
                candidate = optimized_source.copy()
                candidate.thumbnail((max_dimension, max_dimension), resampling)

                for quality in (88, 82, 76, 70, 64):
                    buffer = BytesIO()
                    candidate.save(
                        buffer,
                        format="JPEG",
                        quality=quality,
                        optimize=True,
                        progressive=True
                    )
                    candidate_bytes = buffer.getvalue()

                    if len(candidate_bytes) <= 1_500_000:
                        optimized_bytes = candidate_bytes
                        break

                if optimized_bytes is not None:
                    break

            if optimized_bytes is None:
                raise HTTPException(
                    status_code=413,
                    detail="Could not optimize this image sufficiently. Please upload a smaller or clearer image."
                )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail="Could not process this image. Please upload a valid JPG, PNG or WEBP file."
        ) from error

    encoded_image = base64.b64encode(optimized_bytes).decode("utf-8")
    image_url = f"data:image/jpeg;base64,{encoded_image}"

    print(
        f"AGRICULTURE IMAGE OPTIMIZED: "
        f"{len(image_data)} -> {len(optimized_bytes)} bytes",
        flush=True
    )

    prompt = """You are SARVAM AI Agriculture Vision Engine.

MISSION:
Help farmers understand plant images through accurate visual
observation, calibrated uncertainty and practical guidance.

CORE PRINCIPLE:
Accuracy is more important than confidence.
Clearly distinguish visible evidence, possible explanations
and information that cannot be confirmed.

LANGUAGE:
1. Reply in the same language used by the farmer.
2. Hindi questions must receive simple, natural Hindi responses.
3. Hinglish questions may receive natural Hinglish responses.
4. Avoid unnecessarily complicated scientific terminology.
5. Explain technical terms in farmer-friendly language.
6. Never change language unnecessarily.

IMAGE QUALITY:
1. Assess focus, lighting, blur, resolution and image completeness.
2. Identify whether the image is suitable for analysis.
3. Mention limitations caused by poor image quality.
4. Never assume an image is fake because of a watermark.
5. Never claim to see details that are not visible.

CROP IDENTIFICATION:
1. Identify the crop only when visual evidence supports it.
2. A close-up leaf image may not be sufficient for identification.
3. Do not infer crop identity from regional popularity.
4. If uncertain, clearly state that the crop is not confirmed.
5. Treat the farmer's crop description as useful context,
   not as independent visual confirmation.

VISIBLE SYMPTOMS:
1. Describe only symptoms actually visible in the image.
2. Check leaf colour, spots, lesions, deformation, curling,
   wilting, holes, insects and other visible abnormalities.
3. Do not invent concentric rings, fungal growth or lesions.
4. Yellowing alone does not prove nutrient deficiency.
5. Mosaic patterns alone do not prove viral infection.
6. Brown patches alone do not prove fungal disease.
7. Do not infer disease progression from one photograph.
8. Do not assume the entire field has the same symptoms
   based on one leaf.

POSSIBLE CAUSES:
1. Suggest causes only when supported by visible evidence.
2. Distinguish confirmed observations from possible causes.
3. Do not force a ranked disease diagnosis when evidence is weak.
4. Do not provide a disease-specific diagnosis if crop identity
   and characteristic symptoms are insufficient.
5. Mention when multiple causes can produce similar symptoms.
6. Clearly state when additional information is required.

CONFIDENCE ASSESSMENT:
Assess these separately:
- Image quality: High / Medium / Low.
- Crop identification: High / Medium / Low.
- Symptom observation: High / Medium / Low.
- Possible cause: High / Medium / Low / Not applicable.

Never use false precision or claim 100% certainty.

SAFE RECOMMENDATIONS:


ADDITIONAL FERTILIZER AND IRRIGATION SAFETY:
- Never prescribe generic fertilizer products, ratios, doses or schedules from a photograph.
- Yellow leaves alone do not establish nutrient deficiency.
- Recommend soil testing before specific fertilizer selection.
- Never invent irrigation quantities or fixed watering schedules.
- Never claim current weather without verified weather data.

STRICT FERTILIZER AND CHEMICAL SAFETY:
1. Never recommend Urea, DAP, NPK, micronutrients or other fertilizers
   solely from a leaf photograph.
2. Never assume a nutrient deficiency from pale or yellow leaves alone.
3. Recommend soil testing or expert assessment before suggesting
   a specific fertilizer.
4. Never invent fertilizer quantities, concentrations or schedules.
5. Do not recommend pesticides or fungicides without sufficient evidence.
6. Prefer observation, proper watering and field inspection first.
7. Clearly explain uncertainty to the farmer.
8. NEVER suggest generic fertilizer ratios such as 10-10-10 or
   14-14-14 without soil-test evidence.
9. NEVER recommend a standard fertilizer schedule as a substitute
   for understanding the farmer's actual soil and cultivation conditions.
10. If fertilizer information is insufficient, explicitly say that
    fertilizer selection requires soil testing or local expert guidance.


1. Give practical, low-risk steps first.
2. Prioritize monitoring, sanitation and proper observation.
3. Do not recommend pesticides or fungicides without sufficient
   evidence and appropriate context.
4. Never invent chemical dosages or application schedules.
5. Do not recommend destroying or removing plants based only
   on an uncertain image diagnosis.
6. Recommend local agricultural experts or KVK assistance
   when a serious or uncertain problem requires field inspection.

FOLLOW-UP QUESTIONS:
1. Ask only questions that can materially improve the analysis.
2. Do not repeat information already provided by the farmer.
3. Ask for full-plant, leaf-underside or fruit images when relevant.
4. Ask about crop age, affected area, recent weather or watering
   only when those details matter to the suspected problem.

RESPONSE FORMAT:

## 1. Image Quality
- Suitability:
- Focus and lighting:
- Image limitations:

## 2. Crop Identification
- Identified crop:
- Confidence:
- Supporting observations:

## 3. Visible Symptoms
- Visible observations:
- Symptoms detected:
- Symptoms not observed:

## 4. Possible Causes
- Possible explanation:
- Supporting evidence:
- Uncertainty:

## 5. Confidence Assessment
- Image quality:
- Crop identification:
- Symptom observation:
- Possible cause:

## 6. Recommended Next Steps
Provide practical steps in priority order.
Clearly distinguish immediate actions from monitoring.

## 7. Additional Information Needed
Ask only relevant unanswered questions.

FORMATTING RULES:
1. Use valid Markdown headings with a space after ##.
2. Use proper spaces between every word.
3. Never concatenate words or headings.
4. Use short paragraphs and readable bullet points.
5. Bold important findings and safety warnings.
6. Avoid unnecessary repetition.
7. Keep the seven sections in the specified order.
8. If a section is not applicable, explain why briefly.
9. Do not produce empty or misleading sections.
10. Keep responses concise but sufficiently informative.

FINAL SAFETY RULE:
Never sacrifice accuracy to produce a confident-sounding answer.
If the image does not provide enough evidence, say so honestly."""

    try:
        current_conversation_id = get_or_create_conversation(
            conversation_id
        )
        update_farmer_profile(current_conversation_id, message)
        farmer_profile = get_farmer_profile(current_conversation_id)



        history = get_recent_messages(current_conversation_id)

        # Keep image-analysis input compact to respect Groq ITPM limits.
        recent_history = history[-4:]
        history_text = "\n".join(
            f"{'Farmer' if item['role'] == 'user' else 'SARVAM'}: "
            f"{str(item['content'])[:300]}"
            for item in recent_history
        )

        profile_items = [
            f"- {key.replace('_', ' ').title()}: {str(value)[:100]}"
            for key, value in farmer_profile.items()
            if value is not None and str(value).strip()
        ][:5]
        profile_text = "\n".join(profile_items)

        conversation_context = (
            "Recent relevant conversation:\n"
            + (history_text or "No previous conversation.")
            + "\n\nRelevant farmer profile:\n"
            + (profile_text or "No saved farm details.")
        )[:2500]

        print(
            "AGRICULTURE VISION INPUT:",
            f"history_messages={len(recent_history)}",
            f"context_chars={len(conversation_context)}",
            f"image_bytes={len(optimized_bytes)}",
            flush=True
        )

        completion = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {
                    "role": "system",
                    "content": prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"IMPORTANT: Your entire response MUST be in {detect_farmer_language(message)}. "
                                "Do not reply in English when Hindi or Hinglish is requested. "
                                "Use natural language, proper word spacing and readable Markdown. "
                                "Do not concatenate words. ""Use correct, natural Hindi vocabulary when Hindi is requested. ""For Devanagari Hindi, write entirely in Devanagari script. ""For Hinglish, use natural Roman Hindi mixed with English. ""Do not invent or reinterpret visual symptoms. ""Complete all seven response sections before finishing. "
                                f"{conversation_context}\\n"
                                f"Farmer's current message: {message.strip() or 'Please analyze this crop image.'}"
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url
                            }
                        }
                    ]
                }
            ],
            max_completion_tokens=2000,
            temperature=0.4
        )

        reply = completion.choices[0].message.content

        if not reply:
            raise RuntimeError("Empty image analysis response")

        saved_user_message = (
            message.strip()
            if message.strip()
            else "Please analyze the uploaded crop image."
        )
        save_message(
            current_conversation_id, "user", saved_user_message
        )
        save_message(current_conversation_id, "assistant", reply)

        return {
            "reply": reply,
            "agent": "agriculture-vision",
            "model": "qwen/qwen3.8-27b",
            "conversation_id": current_conversation_id,
            "status": "success"
        }

    except RateLimitError as error:
        raise HTTPException(
            status_code=429,
            detail="AI usage limit reached. Try again later."
        ) from error
    except APIConnectionError as error:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the AI provider."
        ) from error
    except APIStatusError as error:
        response = getattr(error, "response", None)
        response_body = ""

        if response is not None:
            try:
                response_body = response.text[:2000]
            except Exception:
                response_body = repr(getattr(error, "body", ""))[:2000]

        print(
            "AGRICULTURE IMAGE PROVIDER ERROR:",
            "status=", error.status_code,
            "request_id=", getattr(response, "headers", {}).get("x-request-id") if response else None,
            "body=", response_body,
            flush=True
        )

        raise HTTPException(
            status_code=502,
            detail=f"AI provider returned HTTP {error.status_code}: {response_body[:500]}"
        ) from error
    except HTTPException:
        raise
    except Exception as error:
        print("AGRICULTURE IMAGE ERROR:", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail="Agriculture image analysis is temporarily unavailable. Please retry with a clear crop image."
        ) from error












@router.get("/agriculture/profile/{conversation_id}")
def agriculture_profile(conversation_id: str):
    try:
        profile = get_farmer_profile(conversation_id)
        return {
            "conversation_id": conversation_id,
            "profile": profile,
            "status": "success"
        }
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error



@router.get("/agriculture/weather/{conversation_id}")
async def agriculture_weather(conversation_id: str):
    import httpx

    try:
        profile = get_farmer_profile(conversation_id)
        location = profile.get("location")

        if not location:
            raise HTTPException(
                status_code=400,
                detail="Farmer location is not available in the profile."
            )

        async with httpx.AsyncClient(timeout=15.0) as http:
            geo_response = await http.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={
                    "name": location,
                    "count": 1,
                    "language": "en",
                    "format": "json"
                }
            )
            geo_response.raise_for_status()
            geo_data = geo_response.json()

            results = geo_data.get("results", [])
            if not results:
                raise HTTPException(
                    status_code=404,
                    detail=f"Weather location not found: {location}"
                )

            place = results[0]

            weather_response = await http.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": place["latitude"],
                    "longitude": place["longitude"],
                    "current": (
                        "temperature_2m,relative_humidity_2m,"
                        "precipitation,rain,showers,weather_code,"
                        "wind_speed_10m"
                    ),
                    "daily": (
                        "temperature_2m_max,temperature_2m_min,"
                        "precipitation_probability_max,precipitation_sum"
                    ),
                    "forecast_days": 3,
                    "timezone": "auto"
                }
            )
            weather_response.raise_for_status()
            data = weather_response.json()

        return {
            "location": {
                "name": place.get("name"),
                "admin1": place.get("admin1"),
                "country": place.get("country")
            },
            "current": data.get("current", {}),
            "daily": data.get("daily", {}),
            "units": {
                "current": data.get("current_units", {}),
                "daily": data.get("daily_units", {})
            },
            "source": "Open-Meteo",
            "status": "success"
        }

    except HTTPException:
        raise
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail="Weather provider is temporarily unavailable."
        ) from error
    except Exception as error:
        print("AGRICULTURE WEATHER ERROR:", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve agricultural weather."
        ) from error


# Farm Task Tracker APIs
from app.services.agriculture_actions import (
    create_action,
    get_actions,
    get_action,
    update_action,
)
from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class FarmActionRequest(BaseModel):
    title: str
    description: str = ""
    due_date: Optional[str] = None


class FarmActionUpdate(BaseModel):
    conversation_id: str
    status: Optional[str] = None
    description: Optional[str] = None


@router.post("/agriculture/actions/{conversation_id}")
def create_farm_action(conversation_id: str, request: FarmActionRequest):
    try:
        UUID(conversation_id)
        return {
            "success": True,
            "action": create_action(
                conversation_id,
                request.title,
                request.description,
                request.due_date
            )
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/agriculture/actions/{conversation_id}")
def list_farm_actions(conversation_id: str):
    try:
        UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")

    return {
        "success": True,
        "actions": get_actions(conversation_id)
    }


@router.patch("/agriculture/actions/{action_id}")
def edit_farm_action(action_id: str, request: FarmActionUpdate):
    try:
        UUID(action_id)
        UUID(request.conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")

    action = get_action(action_id)

    if not action or action["conversation_id"] != request.conversation_id:
        raise HTTPException(status_code=404, detail="Task not found")

    try:
        updated = update_action(
            action_id,
            request.status,
            request.description
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"success": True, "action": updated}

# ==========================================
# AGRICULTURE RECOMMENDATION HISTORY APIs
# ==========================================

from app.services.agriculture_recommendations import (
    save_recommendation,
    get_recommendations,
    approve_recommendation,
    convert_recommendation_to_task,
)


class RecommendationRequest(BaseModel):
    recommendation: str = Field(min_length=1, max_length=10000)
    source: str = "chat"


class RecommendationApprovalRequest(BaseModel):
    conversation_id: str


class RecommendationConvertRequest(BaseModel):
    conversation_id: str
    title: str = Field(min_length=1, max_length=200)
    due_date: str | None = None


@router.post("/agriculture/recommendations/{conversation_id}")
def save_agriculture_recommendation(
    conversation_id: str,
    request: RecommendationRequest
):
    try:
        result = save_recommendation(
            conversation_id,
            request.recommendation,
            request.source
        )

        return {
            "success": True,
            "recommendation": result
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/agriculture/recommendations/{conversation_id}")
def list_agriculture_recommendations(conversation_id: str):
    try:
        recommendations = get_recommendations(conversation_id)

        return {
            "success": True,
            "recommendations": recommendations
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/agriculture/recommendations/{recommendation_id}/approve")
def approve_agriculture_recommendation(
    recommendation_id: str,
    request: RecommendationApprovalRequest
):
    try:
        UUID(recommendation_id)
        UUID(request.conversation_id)

        result = approve_recommendation(
            recommendation_id,
            request.conversation_id
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Recommendation not found"
            )

        return {
            "success": True,
            "recommendation": result
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/agriculture/recommendations/{recommendation_id}/convert")
def convert_agriculture_recommendation(
    recommendation_id: str,
    request: RecommendationConvertRequest
):
    try:
        UUID(recommendation_id)
        UUID(request.conversation_id)

        result = convert_recommendation_to_task(
            recommendation_id,
            request.conversation_id,
            request.title,
            request.due_date
        )

        return {
            "success": True,
            "recommendation": result["recommendation"],
            "action_id": result["action_id"]
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))




# ==================== FINANCE MODULE ====================

class FinanceEMIRequest(BaseModel):
    principal: float = Field(gt=0, le=100000000000)
    annual_rate: float = Field(ge=0, le=100)
    months: int = Field(ge=1, le=600)


class FinanceBudgetRequest(BaseModel):
    income: float = Field(ge=0, le=100000000000)
    expenses: dict = Field(default_factory=dict)


class FinanceSavingsRequest(BaseModel):
    target_amount: float = Field(gt=0, le=100000000000)
    current_savings: float = Field(ge=0, le=100000000000)
    months: int = Field(ge=1, le=600)


@router.post("/finance/emi")
def finance_emi(request: FinanceEMIRequest):
    try:
        return {
            "success": True,
            "calculation": calculate_emi(
                request.principal,
                request.annual_rate,
                request.months
            )
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/finance/budget")
def finance_budget(request: FinanceBudgetRequest):
    try:
        return {
            "success": True,
            "analysis": calculate_budget(
                request.income,
                request.expenses
            )
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/finance/savings-goal")
def finance_savings_goal(request: FinanceSavingsRequest):
    try:
        return {
            "success": True,
            "savings_plan": calculate_savings_goal(
                request.target_amount,
                request.current_savings,
                request.months
            )
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error



# ==================== SHARED MODULE RECORDS API ====================

class ModuleRecordRequest(BaseModel):
    workspace_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    data: dict = Field(default_factory=dict)


@router.post("/{module_id}/records")
def create_module_record(module_id: str, request: ModuleRecordRequest):
    try:
        result = create_record(
            module_id,
            request.workspace_id,
            request.title,
            request.data
        )
        return {"success": True, "record": result}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/{module_id}/records")
def get_module_records(
    module_id: str,
    workspace_id: str = Query(..., min_length=1, max_length=100),
    limit: int = 100
):
    try:
        records = list_records(module_id, workspace_id, max(1, min(limit, 200)))
        return {"success": True, "total": len(records), "records": records}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{module_id}/records/{record_id}")
def update_module_record(module_id: str, record_id: str, request: ModuleRecordRequest):
    try:
        result = update_record(module_id=module_id, record_id=record_id, workspace_id=request.workspace_id, title=request.title, data=request.data)
        if result is None:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"success": True, "record": result}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/{module_id}/records/{record_id}")
def remove_module_record(
    module_id: str,
    record_id: str,
    workspace_id: str
):
    if not delete_record(record_id, module_id, workspace_id):
        raise HTTPException(status_code=404, detail="Record not found")
    return {"success": True, "deleted": True}


# ==================== ENVIRONMENT LIVE AQI API ====================

class AirQualityRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


@router.post("/environment/air-quality")
def environment_air_quality(request: AirQualityRequest):
    try:
        return get_air_quality(request.latitude, request.longitude)
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

from app.agents.healthcare_agent import answer_healthcare_question
from app.services.healthcare_memory import (
    get_or_create_conversation as get_or_create_healthcare_conversation,
    get_recent_messages as get_recent_healthcare_messages,
    save_message as save_healthcare_message,
    get_conversation_history as get_healthcare_history,
)

# ==================== HEALTHCARE AI API ====================

class HealthcareRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: str | None = None
    health_context: list[dict] | None = None


@router.post("/healthcare/chat")
def healthcare_chat(request: HealthcareRequest):
    try:
        conversation_id = get_or_create_healthcare_conversation(
            request.conversation_id
        )
        history = get_recent_healthcare_messages(conversation_id)

        reply = answer_healthcare_question(
            request.message,
            conversation_history=history,
            health_context=request.health_context
        )

        save_healthcare_message(conversation_id, "user", request.message)
        save_healthcare_message(conversation_id, "assistant", reply)

        return {
            "success": True,
            "conversation_id": conversation_id,
            "reply": reply,
            "model": "healthcare-agent",
            "status": "success"
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RateLimitError as error:
        raise HTTPException(
            status_code=429,
            detail="AI usage limit reached. Please try again later."
        ) from error
    except APIConnectionError as error:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the AI provider."
        ) from error
    except APIStatusError as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI provider returned HTTP {error.status_code}."
        ) from error
    except Exception as error:
        print("HEALTHCARE CHAT ERROR:", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail="Healthcare AI is temporarily unavailable."
        ) from error


@router.get("/healthcare/history/{conversation_id}")
def healthcare_history(conversation_id: str):
    try:
        messages = get_healthcare_history(conversation_id)
        return {
            "success": True,
            "conversation_id": conversation_id,
            "total_messages": len(messages),
            "messages": messages
        }
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

# ==================== GOVERNMENT AI ASSISTANT ====================
from app.services.government_memory import (
    get_or_create_conversation as get_or_create_government_conversation,
    get_recent_messages as get_recent_government_messages,
    save_message as save_government_message,
    get_conversation_history as get_government_history,
)

class GovernmentAssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: str | None = None
    application_context: list[dict] | None = None

@router.post("/government/assistant")
def government_assistant(request: GovernmentAssistantRequest):
    try:
        from app.agents.government_agent import answer_government_question
        cid = get_or_create_government_conversation(request.conversation_id)
        history = get_recent_government_messages(cid)
        reply = answer_government_question(
            request.message,
            application_context=request.application_context,
            conversation_history=history,
        )
        save_government_message(cid, "user", request.message)
        save_government_message(cid, "assistant", reply)
        return {"success": True, "conversation_id": cid, "reply": reply,
                "model": "government-agent", "status": "success"}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RateLimitError as error:
        raise HTTPException(status_code=429, detail="AI usage limit reached. Please try again later.") from error
    except APIConnectionError as error:
        raise HTTPException(status_code=502, detail="Could not connect to the AI provider.") from error
    except APIStatusError as error:
        raise HTTPException(status_code=502, detail=f"AI provider returned HTTP {error.status_code}.") from error
    except Exception as error:
        import traceback
        print("GOVERNMENT AI ERROR:", repr(error), flush=True)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Government AI is temporarily unavailable.") from error

@router.get("/government/history/{conversation_id}")
def government_history(conversation_id: str):
    try:
        return {"conversation_id": conversation_id,
                "messages": get_government_history(conversation_id), "status": "success"}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
# ==================== ENVIRONMENT AI ASSISTANT ====================
from app.services.environment_memory import (
    get_or_create_conversation as get_or_create_environment_conversation,
    get_recent_messages as get_recent_environment_messages,
    save_message as save_environment_message,
    get_conversation_history as get_environment_history,
)

class EnvironmentAssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: str | None = None
    environment_context: list[dict] | None = None

@router.post("/environment/assistant")
def environment_assistant(request: EnvironmentAssistantRequest):
    try:
        from app.agents.environment_agent import answer_environment_question
        cid = get_or_create_environment_conversation(request.conversation_id)
        history = get_recent_environment_messages(cid)
        reply = answer_environment_question(
            request.message,
            environment_context=request.environment_context,
            conversation_history=history,
        )
        save_environment_message(cid, "user", request.message)
        save_environment_message(cid, "assistant", reply)
        return {"success": True, "conversation_id": cid, "reply": reply,
                "model": "environment-agent", "status": "success"}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RateLimitError as error:
        raise HTTPException(status_code=429, detail="AI usage limit reached. Please try again later.") from error
    except APIConnectionError as error:
        raise HTTPException(status_code=502, detail="Could not connect to the AI provider.") from error
    except APIStatusError as error:
        raise HTTPException(status_code=502, detail=f"AI provider returned HTTP {error.status_code}.") from error
    except Exception as error:
        print("ENVIRONMENT AI ERROR:", type(error).__name__)
        raise HTTPException(status_code=500, detail="Environment AI is temporarily unavailable.") from error

@router.get("/environment/history/{conversation_id}")
def environment_history(conversation_id: str):
    try:
        return {"conversation_id": conversation_id,
                "messages": get_environment_history(conversation_id), "status": "success"}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
@router.post("/education/quiz/generate")
def generate_education_quiz(request: QuizGenerateRequest):
    from app.services.education_quiz_generator import generate_quiz_questions
    from app.services.education_quiz import create_quiz

    try:
        conversation_id = get_or_create_education_conversation(
            request.conversation_id
        )
        questions = generate_quiz_questions(
            request.topic,
            request.difficulty,
            request.count
        )
        quiz = create_quiz(
            conversation_id,
            request.topic.strip(),
            request.difficulty.strip().lower(),
            questions
        )

        # Never expose answer keys before submission.
        safe_questions = [
            {
                "question": item["question"],
                "options": item["options"],
                "explanation": ""
            }
            for item in questions
        ]

        return {
            "success": True,
            "conversation_id": conversation_id,
            "quiz": quiz,
            "questions": safe_questions
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        print("EDUCATION QUIZ GENERATION ERROR:", type(error).__name__, repr(error), flush=True)
        raise HTTPException(
            status_code=502,
            detail="Could not generate quiz. Please try again."
        ) from error


@router.post("/education/quiz/{quiz_id}/submit")
def submit_education_quiz(quiz_id: str, request: QuizSubmitRequest):
    from app.services.education_quiz import submit_quiz

    try:
        result = submit_quiz(
            quiz_id,
            request.conversation_id,
            request.answers
        )
        return {"success": True, "result": result}

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        print("EDUCATION QUIZ SUBMISSION ERROR:", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail="Could not submit quiz."
        ) from error


@router.get("/education/quiz/history/{conversation_id}")
def education_quiz_history(conversation_id: str, limit: int = 20):
    from app.services.education_quiz import get_quiz_history

    try:
        return {
            "success": True,
            "history": get_quiz_history(conversation_id, limit)
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/education/quiz/progress/{conversation_id}")
def education_quiz_progress(conversation_id: str):
    from app.services.education_quiz import get_quiz_progress

    try:
        return {
            "success": True,
            "progress": get_quiz_progress(conversation_id)
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error



from app.api.youtube_lecture_routes import router as youtube_lecture_router
router.include_router(youtube_lecture_router)

