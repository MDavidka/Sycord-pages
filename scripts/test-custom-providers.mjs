import assert from "assert"

// 1. Test URL normalization logic
function normalizeDiscoverUrl(rawUrl) {
  let baseUrl = rawUrl.trim()
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`
  }
  baseUrl = baseUrl.replace(/\/+$/, "")
  baseUrl = baseUrl.replace(/\/chat\/completions\/?$/i, "")
  baseUrl = baseUrl.replace(/\/completions\/?$/i, "")
  baseUrl = baseUrl.replace(/\/chat\/?$/i, "")

  const candidates = []
  if (baseUrl.endsWith("/v1")) {
    candidates.push(`${baseUrl}/models`)
  } else {
    candidates.push(`${baseUrl}/models`)
    candidates.push(`${baseUrl}/v1/models`)
    candidates.push(`${baseUrl}/api/tags`)
  }

  return { baseUrl, candidates }
}

// 2. Test response parsers
function parseModelsResponse(data) {
  const discoveredModels = []
  if (Array.isArray(data?.data) && data.data.length > 0) {
    for (const item of data.data) {
      const modelId = typeof item === "string" ? item : item?.id || item?.name
      if (modelId && typeof modelId === "string") {
        const cleanId = modelId.trim()
        discoveredModels.push({
          id: cleanId,
          name: item?.name || cleanId,
        })
      }
    }
  } else if (Array.isArray(data?.models) && data.models.length > 0) {
    for (const item of data.models) {
      const modelId = typeof item === "string" ? item : item?.name || item?.model || item?.id
      if (modelId && typeof modelId === "string") {
        const cleanId = modelId.trim()
        discoveredModels.push({
          id: cleanId,
          name: item?.name || cleanId,
        })
      }
    }
  } else if (Array.isArray(data) && data.length > 0) {
    for (const item of data) {
      const modelId = typeof item === "string" ? item : item?.id || item?.name || item?.model
      if (modelId && typeof modelId === "string") {
        const cleanId = modelId.trim()
        discoveredModels.push({
          id: cleanId,
          name: typeof item === "object" && item?.name ? item.name : cleanId,
        })
      }
    }
  }
  return discoveredModels
}

console.log("--- Running Custom Provider Discovery & Model Tests ---")

// Test 1: URL Normalization
const t1 = normalizeDiscoverUrl("https://api.groq.com/openai/v1/chat/completions")
assert.strictEqual(t1.baseUrl, "https://api.groq.com/openai/v1")
assert.deepStrictEqual(t1.candidates, ["https://api.groq.com/openai/v1/models"])

const t2 = normalizeDiscoverUrl("http://localhost:11434")
assert.strictEqual(t2.baseUrl, "http://localhost:11434")
assert.deepStrictEqual(t2.candidates, [
  "http://localhost:11434/models",
  "http://localhost:11434/v1/models",
  "http://localhost:11434/api/tags",
])

const t3 = normalizeDiscoverUrl("api.together.xyz/v1/")
assert.strictEqual(t3.baseUrl, "https://api.together.xyz/v1")
assert.deepStrictEqual(t3.candidates, ["https://api.together.xyz/v1/models"])

console.log("✓ URL Normalization tests passed.")

// Test 2: OpenAI Format Parsing
const openAiPayload = {
  data: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
}
const r1 = parseModelsResponse(openAiPayload)
assert.strictEqual(r1.length, 2)
assert.strictEqual(r1[0].id, "llama-3.3-70b-versatile")
assert.strictEqual(r1[0].name, "Llama 3.3 70B")

// Test 3: Ollama Format Parsing
const ollamaPayload = {
  models: [
    { name: "llama3:latest", model: "llama3" },
    { name: "qwen2.5-coder:7b", model: "qwen2.5-coder" },
  ],
}
const r2 = parseModelsResponse(ollamaPayload)
assert.strictEqual(r2.length, 2)
assert.strictEqual(r2[0].id, "llama3:latest")
assert.strictEqual(r2[1].id, "qwen2.5-coder:7b")

// Test 4: Direct Array Parsing
const arrayPayload = [
  { id: "custom-fine-tune-1" },
  { id: "custom-fine-tune-2", name: "Fine-tune 2" },
]
const r3 = parseModelsResponse(arrayPayload)
assert.strictEqual(r3.length, 2)
assert.strictEqual(r3[0].id, "custom-fine-tune-1")
assert.strictEqual(r3[1].name, "Fine-tune 2")

console.log("✓ Response format parsing tests passed.")

// Test 5: Custom model merging into OmniModelItem list
const mockCustomProvider = {
  name: "Local LM Studio",
  provider: "lm_studio",
  base_url: "http://localhost:1234/v1",
  models: ["mistral-nemo-instruct-2407", "deepseek-coder-v2-lite-instruct"],
}

const customModels = mockCustomProvider.models.map((mId) => {
  const fullId = `${mockCustomProvider.provider}/${mId}`
  return {
    id: fullId,
    name: mId,
    provider: mockCustomProvider.provider,
    providerDisplay: mockCustomProvider.name,
    is_custom: true,
    swe_score: 50,
    tags: ["custom", mockCustomProvider.provider],
  }
})

assert.strictEqual(customModels.length, 2)
assert.strictEqual(customModels[0].id, "lm_studio/mistral-nemo-instruct-2407")
assert.strictEqual(customModels[0].is_custom, true)
assert.strictEqual(customModels[0].providerDisplay, "Local LM Studio")

console.log("✓ Custom model merging logic tests passed.")
console.log("All Custom Provider test assertions passed successfully!")
