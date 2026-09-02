#!/usr/bin/env python3
"""TTS synthesis using edge-tts with boundary extraction.

Supports edge-tts v6 (WordBoundary) and v7+ (SentenceBoundary).
Falls back to generating word-level boundaries from text when no boundaries are received.
"""

import asyncio
import edge_tts
import json
import sys
import os
import re


async def synthesize(text, voice, rate, pitch, volume, output_path):
    """Synthesize text to speech and extract boundaries."""
    communicate = edge_tts.Communicate(
        text, voice, rate=rate, pitch=pitch, volume=volume
    )

    audio_chunks = []
    boundaries = []
    boundary_types = set()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
        elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
            boundary_types.add(chunk["type"])
            # offset/duration are in 100ns units, convert to ms
            boundaries.append({
                "text": chunk["text"],
                "offset_ms": chunk["offset"] / 10000,
                "duration_ms": chunk["duration"] / 10000
            })

    if not audio_chunks:
        raise edge_tts.exceptions.NoAudioReceived(
            "No audio was received. Please verify that your parameters are correct."
        )

    # Write audio file
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(b"".join(audio_chunks))

    # If only SentenceBoundary (edge-tts v7+), always split into word-level
    # WordBoundary (edge-tts v6) is already word-level, no splitting needed
    if "SentenceBoundary" in boundary_types or not boundaries:
        if not boundaries:
            boundaries = generate_estimated_boundaries(text, len(b"".join(audio_chunks)))
        # Split sentence boundaries into word/phrase-level for subtitle sync
        boundaries = split_into_word_boundaries(boundaries, text)

    # Output JSON result to stdout
    result = {
        "audio_file": output_path,
        "word_boundaries": boundaries,
        "boundary_count": len(boundaries)
    }
    print(json.dumps(result, ensure_ascii=False))


def split_into_word_boundaries(sentence_boundaries, full_text):
    """Split sentence-level boundaries into phrase-level for subtitle animation.
    
    For Chinese text, split by punctuation and natural pauses (every 3-6 chars).
    For mixed text, also split by spaces.
    """
    word_boundaries = []
    
    for sb in sentence_boundaries:
        sentence_text = sb["text"]
        sentence_offset = sb["offset_ms"]
        sentence_duration = sb["duration_ms"]
        
        # Split by Chinese punctuation first
        parts = re.split(r'([，。！？；：、,\.!?;:])', sentence_text)
        
        # Reconstruct phrases with delimiters
        phrases = []
        current = ""
        for part in parts:
            current += part
            if part and part[-1:] in "，。！？；：、,\.!?;:":
                phrases.append(current)
                current = ""
        if current:
            phrases.append(current)
        
        # Further split long phrases (Chinese: every 4-6 chars; English: by spaces)
        refined = []
        for phrase in phrases:
            phrase = phrase.strip()
            if not phrase:
                continue
            # If contains spaces (English), split by words
            if " " in phrase:
                words = phrase.split(" ")
                buf = ""
                for w in words:
                    if len(buf) + len(w) > 12 and buf:
                        refined.append(buf)
                        buf = w
                    else:
                        buf = buf + " " + w if buf else w
                if buf:
                    refined.append(buf)
            elif len(phrase) > 8:
                # Split Chinese phrase into ~4-char segments
                for i in range(0, len(phrase), 4):
                    seg = phrase[i:i+4]
                    if seg:
                        refined.append(seg)
            else:
                refined.append(phrase)
        
        # Distribute timing proportionally
        total_chars = sum(len(p) for p in refined) or 1
        current_offset = sentence_offset
        for phrase in refined:
            phrase_duration = (len(phrase) / total_chars) * sentence_duration
            word_boundaries.append({
                "text": phrase,
                "offset_ms": current_offset,
                "duration_ms": phrase_duration
            })
            current_offset += phrase_duration
    
    return word_boundaries


def generate_estimated_boundaries(text, audio_byte_count):
    """Generate estimated word/phrase boundaries when edge-tts doesn't provide them.
    
    Splits text into segments and distributes timing proportionally.
    """
    # Split into phrases by punctuation or natural pauses
    segments = re.split(r'([，。！？；：、,\.!?;:])', text)
    
    # Reconstruct phrases with their delimiters
    phrases = []
    current_phrase = ""
    for seg in segments:
        current_phrase += seg
        if seg in "，。！？；：、,\.!?;:":
            phrases.append(current_phrase)
            current_phrase = ""
    if current_phrase:
        phrases.append(current_phrase)
    
    # If phrases are too long, split further by length
    final_phrases = []
    for p in phrases:
        p = p.strip()
        if not p:
            continue
        if len(p) > 20:
            # Split long phrases at midpoints
            mid = len(p) // 2
            # Find nearest space or just split
            final_phrases.append(p[:mid])
            final_phrases.append(p[mid:])
        else:
            final_phrases.append(p)
    
    # Estimate total duration from audio bytes (rough: 48kbps = 6000 bytes/sec)
    est_duration_ms = (audio_byte_count / 6000) * 1000
    
    # Distribute time proportionally to phrase length
    total_chars = sum(len(p) for p in final_phrases) or 1
    boundaries = []
    current_offset = 0
    for phrase in final_phrases:
        phrase_duration = (len(phrase) / total_chars) * est_duration_ms
        boundaries.append({
            "text": phrase,
            "offset_ms": current_offset,
            "duration_ms": phrase_duration
        })
        current_offset += phrase_duration
    
    return boundaries


if __name__ == "__main__":
    # Args: text|voice|rate|pitch|volume|output_path
    if len(sys.argv) < 7:
        print(json.dumps({
            "error": "Usage: tts.py <text> <voice> <rate> <pitch> <volume> <output_path>"
        }))
        sys.exit(1)

    text = sys.argv[1]
    voice = sys.argv[2]
    rate = sys.argv[3]
    pitch = sys.argv[4]
    volume = sys.argv[5]
    output_path = sys.argv[6]

    asyncio.run(synthesize(text, voice, rate, pitch, volume, output_path))
