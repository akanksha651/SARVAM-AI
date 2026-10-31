from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.youtube_lecture import (
    extract_video_id,
    extract_transcript,
    analyze_transcript,
    save_lecture,
    list_lectures,
    get_lecture,
    ask_lecture,
    get_lecture_quiz_history,
)

router = APIRouter(prefix="/youtube-lectures", tags=["YouTube Lecture Intelligence"])

class AnalyzeRequest(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    transcript: str | None = Field(default=None, max_length=300000)

class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=3000)

@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        video_id = extract_video_id(request.url)
        transcript = request.transcript.strip() if request.transcript else None

        if transcript:
            if len(transcript) < 30:
                raise HTTPException(status_code=400, detail="Transcript is too short.")
            source = "manual"
        else:
            transcript = extract_transcript(video_id)
            source = "youtube_captions"

        if len(transcript) > 300000:
            raise HTTPException(status_code=413, detail="Transcript exceeds the 300,000 character limit.")

        analysis = analyze_transcript(transcript)
        lecture = save_lecture(video_id, request.url, transcript, analysis)

        return {
            "success": True,
            "source": source,
            "lecture": {k: v for k, v in lecture.items() if k != "transcript"},
        }

    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        print("YOUTUBE LECTURE ANALYSIS ERROR:", repr(error), flush=True)
        raise HTTPException(status_code=502, detail="Lecture processing failed. Check captions availability and AI service.")

@router.get("")
def lectures():
    return {"success": True, "lectures": list_lectures()}

@router.get("/{lecture_id}")
def lecture_detail(lecture_id: str):
    lecture = get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found.")
    return {"success": True, "lecture": lecture}

@router.post("/{lecture_id}/ask")
def lecture_question(lecture_id: str, request: AskRequest):
    try:
        answer = ask_lecture(lecture_id, request.question)
        return {"success": True, "answer": answer}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        print("LECTURE QUESTION ERROR:", repr(error), flush=True)
        raise HTTPException(status_code=502, detail="Could not answer the lecture question.")


# ---------- LECTURE QUIZ API ----------

from app.services.youtube_lecture import (
    generate_lecture_quiz,
    submit_lecture_quiz,
)

class LectureQuizRequest(BaseModel):
    count: int = Field(default=5, ge=3, le=10)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")

class LectureQuizSubmitRequest(BaseModel):
    answers: dict[str, int]

@router.post("/{lecture_id}/quiz")
def create_lecture_quiz(lecture_id: str, request: LectureQuizRequest):
    try:
        return {
            "success": True,
            "quiz": generate_lecture_quiz(
                lecture_id,
                request.count,
                request.difficulty,
            ),
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        print("LECTURE QUIZ ERROR:", repr(error), flush=True)
        raise HTTPException(status_code=502, detail="Quiz generation failed.")

@router.post("/quiz/{quiz_id}/submit")
def submit_lecture_quiz_api(
    quiz_id: str,
    request: LectureQuizSubmitRequest,
):
    try:
        return {
            "success": True,
            "result": submit_lecture_quiz(quiz_id, request.answers),
        }
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        print("LECTURE QUIZ SUBMISSION ERROR:", repr(error), flush=True)
        raise HTTPException(status_code=500, detail="Quiz submission failed.")


# ---------- LECTURE QUIZ HISTORY API ----------

@router.get("/{lecture_id}/quiz/history")
def lecture_quiz_history_api(lecture_id: str):
    try:
        if not get_lecture(lecture_id):
            raise HTTPException(status_code=404, detail="Lecture not found.")
        return {
            "success": True,
            "history": get_lecture_quiz_history(lecture_id),
        }
    except HTTPException:
        raise
    except Exception as error:
        print("LECTURE QUIZ HISTORY ERROR:", repr(error), flush=True)
        raise HTTPException(status_code=500, detail="Could not load quiz history.")
