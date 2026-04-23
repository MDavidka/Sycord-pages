import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * Web Search API — searches the web for relevant information and images
 * using Google Custom Search JSON API.
 *
 * Falls back to a Gemini grounding search when Custom Search is not configured.
 */

const GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

interface SearchResult {
  title: string
  link: string
  snippet: string
  image?: string
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { query, type = "general" } = await request.json()
    if (!query || typeof query !== "string") {
      return NextResponse.json({ message: "Missing search query" }, { status: 400 })
    }

    const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

    // If Custom Search is configured, use it
    if (searchApiKey && searchEngineId) {
      const params = new URLSearchParams({
        key: searchApiKey,
        cx: searchEngineId,
        q: query,
        num: "5",
      })

      if (type === "images") {
        params.set("searchType", "image")
        params.set("imgType", "photo")
        params.set("imgSize", "large")
        params.set("fileType", "png")
      }

      const res = await fetch(`${GOOGLE_SEARCH_URL}?${params.toString()}`)
      if (!res.ok) {
        console.error("[WebSearch] Google Custom Search error:", res.status)
        return fallbackSearch(query, type)
      }

      const data = await res.json()
      const results: SearchResult[] = (data.items || []).map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet || "",
        image: item.pagemap?.cse_image?.[0]?.src || item.link || undefined,
      }))

      return NextResponse.json({ results, source: "google" })
    }

    // Fallback: use Gemini to generate search-like context
    return fallbackSearch(query, type)
  } catch (error: any) {
    console.error("[WebSearch] Error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

async function fallbackSearch(query: string, type: string) {
  const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      results: [],
      source: "none",
      message: "No search API configured",
    })
  }

  // Use Gemini to synthesize relevant information
  const prompt =
    type === "images" ? `Find 5 high-quality, royalty-free image URLs (prefer .png) relevant to:"${query}". Return ONLY a JSON array of objects with keys: title, link, snippet, image. No markdown.`
      : `Search the web and find 5 relevant results about: "${query}". Return ONLY a JSON array of objects with keys: title, link, snippet. No markdown.`

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages: [
            { role: "system", content: "You are a web search assistant. Return ONLY valid JSON arrays, no markdown fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      }
    )

    if (!res.ok) {
      return NextResponse.json({ results: [], source: "fallback_error" })
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || "[]"

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const results: SearchResult[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return NextResponse.json({ results, source: "gemini_fallback" })
  } catch {
    return NextResponse.json({ results: [], source: "fallback_error" })
  }
}
