"""Layanan AI tambahan: analisis kondisi emosional pengguna.

Analisis ini bersifat INTERNAL — dipakai untuk memutuskan apakah perlu
menampilkan rekomendasi psikolog/psikiater. Hasilnya TIDAK pernah
disampaikan ke pengguna sebagai diagnosis klinis.
"""
import json
import os
import re
from typing import List, Dict, Any, Optional, Generator

from openai import OpenAI


# Model analisis — output JSON terstruktur
ANALYSIS_MODEL = "openai/gpt-oss-120b"
CHAT_MODEL = "openai/gpt-oss-120b"

# Kondisi yang dikenali (label internal, bukan diagnosis medis formal)
CONDITIONS = [
    "kecemasan",
    "depresi",
    "burnout",
    "stres",
    "duka",
    "masalah-hubungan",
    "trauma",
    "none",
]

CONDITION_ANALYSIS_SYSTEM_PROMPT = (
    "Kamu adalah analis emosional untuk aplikasi 'Teman Bicara AI'."
    " Tugasmu menganalisis pola percakapan antara pengguna dan asisten."
    " Analisis ini bersifat internal dan tidak pernah ditampilkan langsung ke pengguna.\n\n"
    "TUGAS:\n"
    "Baca seluruh riwayat percakapan. Identifikasi apakah pengguna menunjukkan"
    " pola yang konsisten dengan salah satu kondisi berikut:\n"
    "- 'kecemasan' — khawatir berlebihan, gelisah, sulit tenang, panik\n"
    "- 'depresi' — kesedihan menetap, kehilangan minat, putus asa, merasa hampa\n"
    "- 'burnout' — kelelahan berkepanjangan, jenuh, kehilangan motivasi\n"
    "- 'stres' — tekanan dari pekerjaan/kehidupan yang terasa berlebihan\n"
    "- 'duka' — kehilangan orang/hal yang berharga, berduka\n"
    "- 'masalah-hubungan' — konflik dengan pasangan/keluarga/teman\n"
    "- 'trauma' — pengalaman menyakitkan masa lalu yang masih membebani\n"
    "- 'none' — tidak ada pola signifikan\n\n"
    "PERTIMBANGKAN:\n"
    "- Seberapa konsisten tanda-tanda muncul (bukan hanya satu kali)\n"
    "- Seberapa berat dampaknya terhadap aktivitas sehari-hari\n"
    "- Apakah masalah berulang di banyak pesan\n"
    "- Apakah pengguna sendiri menyebut butuh bantuan profesional\n\n"
    "JAWAB HANYA DENGAN JSON VALID, tanpa teks lain, dalam format:\n"
    "{\n"
    '  "condition": "salah satu label di atas",\n'
    '  "confidence": 0.0-1.0,\n'
    '  "recommend": true atau false,\n'
    '  "reason": "satu kalimat singkat dalam bahasa Indonesia, '
    'contoh: pengguna menunjukkan tanda-tanda kesedihan yang menetap",\n'
    "}\n\n"
    "ATURAN:\n"
    "- 'recommend' hanya true jika polanya cukup konsisten dan berat."
    " Jangan menyarankan untuk masalah ringan atau percakapan singkat.\n"
    "- 'confidence' mencerminkan seberapa yakin analis terhadap label.\n"
    "- Jika percakapan singkat (< 3 pesan user), gunakan 'none' dan recommend=false.\n"
    "- Tidak boleh menuliskan diagnosis medis formal (mis. 'gangguan depresi mayor')."
    " Label di atas sudah cukup.\n"
)

ANALYSIS_USER_PROMPT = (
    "Berikut riwayat percakapan (terbaru paling bawah):\n\n{dialogue}\n\n"
    "Lakukan analisis dan kembalikan JSON sesuai aturan."
)


def _build_client() -> OpenAI:
    """Buat klien OpenAI yang menunjuk ke Groq."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY belum dikonfigurasi.")
    return OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Ambil objek JSON pertama dari teks respons (fallback parsing)."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _safe_result(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Normalisasi hasil analisis agar selalu berbentuk dict yang valid."""
    if not isinstance(data, dict):
        return {"condition": None, "confidence": 0.0, "recommend": False, "reason": ""}

    condition = data.get("condition")
    if condition not in CONDITIONS:
        condition = None

    try:
        confidence = float(data.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    recommend = bool(data.get("recommend", False))
    reason = str(data.get("reason") or "").strip()

    return {
        "condition": condition,
        "confidence": confidence,
        "recommend": recommend,
        "reason": reason,
    }


def _format_dialogue(messages: List[Dict[str, str]], profile: Optional[Dict[str, Any]] = None) -> str:
    """Susun petikan percakapan untuk prompt analisis."""
    lines: List[str] = []
    if profile:
        name = profile.get("name")
        age = profile.get("age")
        if name:
            lines.append(f"[Profil: nama={name}]")
        if age:
            lines.append(f"[Profil: usia={age}]")
        if profile.get("occupation"):
            lines.append(f"[Profil: pekerjaan={profile.get('occupation')}]")
    for msg in messages:
        role = "Pengguna" if msg.get("role") == "user" else "Asisten"
        content = (msg.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def analyze_condition(messages: List[Dict[str, str]], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Analisis kondisi emosional dari riwayat percakapan.

    Args:
        messages: list dict {role, content} — riwayat percakapan.
        profile: dict opsional (name, age, occupation, ...).

    Returns:
        dict: {condition, confidence, recommend, reason}
        Selalu mengembalikan dict valid, tidak pernah raise.
    """
    user_messages = [
        m for m in messages
        if m.get("role") == "user" and (m.get("content") or "").strip()
    ]

    if len(user_messages) < 3:
        return {
            "condition": None,
            "confidence": 0.0,
            "recommend": False,
            "reason": "Percakapan masih terlalu singkat untuk dianalisis.",
        }

    dialogue = _format_dialogue(messages, profile)
    user_prompt = ANALYSIS_USER_PROMPT.format(dialogue=dialogue)

    try:
        client = _build_client()
        response = _perform_analysis(client, user_prompt)
        raw = (response.choices[0].message.content or "").strip()
        data = _extract_json(raw)
        return _safe_result(data)
    except Exception:
        return {
            "condition": None,
            "confidence": 0.0,
            "recommend": False,
            "reason": "",
        }

def _perform_analysis(client: OpenAI, user_prompt: str) -> Any:
    """Eksekusi LLM request untuk analisis."""
    try:
        return client.chat.completions.create(
            model=ANALYSIS_MODEL,
            messages=[
                {"role": "system", "content": CONDITION_ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            stream=False,
        )
    except Exception:
        return client.chat.completions.create(
            model=ANALYSIS_MODEL,
            messages=[
                {"role": "system", "content": CONDITION_ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            stream=False,
        )

def build_chat_system_instruction(profile: Optional[Dict[str, Any]] = None) -> str:
    """Build the system instruction for the chat model."""
    instruction = (
        "Kamu adalah Teman Bicara AI, konselor virtual yang hangat, tenang, dan penuh empati.\n"
        "Kamu bukan psikolog, psikiater, atau dokter — kamu adalah pendengar yang baik.\n"
        "Tujuanmu membuat pengguna merasa didengar dan dipahami, bukan memberi ceramah panjang.\n\n"
        "ATURAN RESPONS UTAMA:\n"
        "- RESPONS PENDEK. Untuk cerita ringan: 2–3 kalimat, maksimal 4. Untuk masalah berat:"
        " maksimal 6 kalimat pendek atau 3–4 bullet singkat. Jangan pernah menulis paragraf panjang.\n"
        "- STRUKTUR ADVICE YANG BENAR (ikuti pola ini untuk masalah berat):\n"
        "  (1) Validasi perasaan singkat: 'Wajar kok kalau kamu merasa...'\n"
        "  (2) Perspektif realistis yang jujur: sentuh kenyataan dengan lembut tanpa menghakimi.\n"
        "  (3) Poin-poin advice konkret dan menyentuh emosional — maksimal 3–4 poin,"
        " satu kalimat per poin. Boleh memakai layout nomor atau bullet.\n"
        "  (4) Opsional: SATU pertanyaan reflektif di paling akhir untuk mengajak pengguna introspeksi.\n"
        "- UTAMAKAN ADVICE YANG MENYENTUH EMOSIONAL — bukan pertanyaan.\n"
        "- JANGAN SERING MELEMPAR PERTANYAAN. Pertanyaan hanya sesekali, paling banyak satu per respons.\n"
        "- Berikan advice yang tepat sasaran dan hangat — bukan saran generik, bukan ceramah, tanpa menghakimi.\n"
        "- Jangan mengulang panjang cerita pengguna. Cukup tangkap inti perasaannya dalam satu kalimat singkat.\n\n"
        "EMOTICON (PENTING):\n"
        "- JANGAN MEMAKAI EMOTICON PADA TOPIK BERAT: perselingkuhan, penyesalan, duka, konflik,"
        " trauma, atau topik serius lainnya — TIDAK BOLEH ada emoticon sama sekali di respons itu.\n"
        "- Emoticon hanya dipakai sesekali di momen yang benar-benar terasa ringan/hangat"
        " (misal: 💙, 🌷, 🤗, 🌻, 🫂, ✨). Banyak respons tidak perlu emoticon.\n\n"
        "CONTOH RESPONS YANG BAIK:\n"
        "Pengguna: 'Aku lagi galau karena pacarku jarang balas pesan.'\n"
        "Kamu: 'Rasanya pasti mengganggu ya kalau orang yang kita sayang terasa jauh."
        " Mungkin dia sedang sibuk, tapi wajar kok kalau kamu ingin direspons —"
        " coba sampaikan perasaanmu pelan-pelan tanpa menuntut.'\n"
        "Pengguna: 'Dua tahun lalu aku selingkuh, sekarang aku kangen dan galau.'\n"
        "Kamu: 'Wajar kok kalau perasaan itu muncul lagi. Tapi mari melihatnya dengan jujur:\n"
        "1. Sadari kangenmu ini bercampur rasa bersalah — perselingkuhan meninggalkan luka yang dalam.\n"
        "2. Kalau menghubunginya hanya untuk melegakan dirimu sendiri, tahan dulu. Hormati ruang dan ketenangannya.\n"
        "3. Maafkan dirimu pelan-pelan, dan jadikan pengalaman ini pengingat untuk tidak mengulang.\n"
        "Ada pemicu tertentu yang membuat ingatan ini tiba-tiba kuat sekarang?'\n\n"
        "HAL LAIN:\n"
        "- Selalu validasi emosi pengguna terlebih dahulu sebelum merespons.\n"
        "- Dengarkan lebih banyak daripada berbicara.\n"
        "- Jangan pernah menghakimi, menyalahkan, atau mendiagnosis secara klinis.\n"
        "- Jangan menyarankan obat medis atau dosis apapun.\n"
        "- Gunakan bahasa Indonesia yang natural, hangat, dan mudah dipahami.\n\n"
        "KONDISI DARURAT:\n"
        "Jika pengguna mengungkapkan keinginan menyakiti diri sendiri atau orang lain,"
        " tetap tenang, validasi perasaan mereka, dan dengan lembut dorong mereka menghubungi"
        " orang yang dipercaya atau layanan darurat (119 ext. 8)."
        " Pada kondisi darurat, respons boleh lebih panjang dari biasanya.\n\n"
        "MEMBACA KONDISI PENGGUNA:\n"
        "Perhatikan dengan seksama pola cerita pengguna. Setelah beberapa pesan, jika kamu"
        " mendeteksi tanda-tanda yang konsisten dengan kondisi seperti kecemasan, depresi,"
        " burnout, atau tekanan berat, kamu boleh dengan sangat lembut dan tidak menghakimi"
        " menyebutkan bahwa berbicara dengan psikolog atau psikiater bisa sangat membantu —"
        " bukan sebagai diagnosis, tapi sebagai bentuk kepedulian tulus."
    )
    if profile:
        details = []
        if profile.get('name'):
            details.append(f"nama: {profile.get('name')}")
        if profile.get('age'):
            details.append(f"usia: {profile.get('age')} tahun")
        if profile.get('gender'):
            details.append(f"jenis kelamin: {profile.get('gender')}")
        if profile.get('occupation'):
            details.append(f"pekerjaan: {profile.get('occupation')}")
        if details:
            instruction += (
                "\n\nProfil pengguna saat ini: "
                + ", ".join(details)
                + ". Gunakan konteks ini secara wajar tanpa menyinggungnya secara berlebihan."
            )
    return instruction

def stream_chat_response(messages: List[Dict[str, str]]) -> Generator[str, None, None]:
    """Streams the response from the chat model."""
    client = _build_client()
    response = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        stream=True,
    )
    
    try:
        for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta is not None:
                yield delta
    except Exception as e:
        yield f"\n\nMaaf, terjadi kesalahan: {str(e)}"
