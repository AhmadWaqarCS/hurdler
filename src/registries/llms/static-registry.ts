import type { ProviderDefinition } from "./types.js";

export const STATIC_PROVIDERS: Record<string, ProviderDefinition> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    envKeyNames: ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEYS", "CLAUDE_API_KEY"],
    models: {
      "claude-sonnet-5": {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        providerId: "anthropic",
        capabilities: {
          inputModalities: ["text", "image"],
          outputModalities: ["text"],

          supportsStreaming: true,
          supportsTools: true,
          supportsStructuredOutputs: true,
          supportsPromptCaching: true,
          supportsReasoning: true,

          thinkingType: "adaptive",
          supportedThinkingEfforts: ["low", "medium", "high", "xhigh", "max"],
          defaultThinkingEffort: "high",

          supportsSearchGrounding: false,
          supportsMapsGrounding: false,
          supportsCodeExecution: true,
          supportsComputerUse: true,
          supportsFileSearch: false,
          supportsUrlContext: false,
          supportsLiveApi: false,
          supportsAudioGeneration: false,
          supportsImageGeneration: false,

          supportsBatch: true,
          supportsFlex: false,
          supportsPriority: false,

          maxContextTokens: 1000000,
          maxOutputTokens: 128000,
          maxBatchOutputTokens: 300000,

          // Setting temperature, top_p, or top_k to non-default values returns a 400 error on Claude Sonnet 5
          supportsCustomSamplingParams: false,

          knowledgeCutoff: "Jan 2026",
          releaseDate: "June 30, 2026",
        },
        pricing: {
          standard: {
            inputCostPerMillion: 2.0,
            outputCostPerMillion: 10.0,
            cachedReadCostPerMillion: 0.2,
            cachedWriteCostPerMillion: 2.5,
            cachedWrite1hCostPerMillion: 4.0,
          },
          batch: {
            inputCostPerMillion: 1.0,
            outputCostPerMillion: 5.0,
            cachedReadCostPerMillion: 0.2,
            cachedWriteCostPerMillion: 2.5,
            cachedWrite1hCostPerMillion: 4.0,
          },
        },
        defaultTier: "standard",
      },
    },
  },

  google: {
    id: "google",
    name: "Google Gemini (AI Studio)",
    envKeyNames: [
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GOOGLE_API_KEY",
      "GOOGLE_API_KEYS",
      "GEMINI_API_KEY",
    ],
    models: {
      "gemini-3.7-flash": {
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash",
        providerId: "google",
        capabilities: {
          inputModalities: ["text", "image", "video", "audio", "pdf"],
          outputModalities: ["text"],

          supportsStreaming: true,
          supportsTools: true,
          supportsStructuredOutputs: true,
          supportsPromptCaching: true,
          supportsReasoning: true,

          thinkingType: "levels",
          supportedThinkingEfforts: ["low", "medium", "high"],
          defaultThinkingEffort: "medium",

          supportsSearchGrounding: true,
          supportsMapsGrounding: true,
          supportsCodeExecution: true,
          supportsComputerUse: true,
          supportsFileSearch: true,
          supportsUrlContext: true,
          supportsLiveApi: false,
          supportsAudioGeneration: false,
          supportsImageGeneration: false,

          supportsBatch: true,
          supportsFlex: true,
          supportsPriority: true,

          maxContextTokens: 1048576,
          maxOutputTokens: 65536,

          supportsCustomSamplingParams: true,
          defaultTemperature: 0.7,

          knowledgeCutoff: "August 2026",
          releaseDate: "August 2026",
        },
        pricing: {
          standard: {
            inputCostPerMillion: 0.75,
            outputCostPerMillion: 3.75,
            cachedReadCostPerMillion: 0.075,
          },
          batch: {
            inputCostPerMillion: 0.375,
            outputCostPerMillion: 1.875,
            cachedReadCostPerMillion: 0.0375,
          },
          flex: {
            inputCostPerMillion: 0.375,
            outputCostPerMillion: 1.875,
            cachedReadCostPerMillion: 0.0375,
          },
          priority: {
            inputCostPerMillion: 0.75,
            outputCostPerMillion: 3.75,
            cachedReadCostPerMillion: 0.075,
          },
        },
        defaultTier: "standard",
      },
    },
  },

  "google-vertex": {
    id: "google-vertex",
    name: "Google Cloud Vertex AI",
    envKeyNames: [
      "GOOGLE_APPLICATION_CREDENTIALS",
      "GOOGLE_CLOUD_PROJECT",
      "GCP_PROJECT_ID",
      "GOOGLE_CLOUD_LOCATION",
      "GCP_REGION",
    ],
    models: {
      "gemini-3.7-flash": {
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash (Vertex AI)",
        providerId: "google-vertex",
        capabilities: {
          inputModalities: ["text", "image", "video", "audio", "pdf"],
          outputModalities: ["text"],

          supportsStreaming: true,
          supportsTools: true,
          supportsStructuredOutputs: true,
          supportsPromptCaching: true,
          supportsReasoning: true,

          thinkingType: "levels",
          supportedThinkingEfforts: ["low", "medium", "high"],
          defaultThinkingEffort: "medium",

          supportsSearchGrounding: true,
          supportsMapsGrounding: true,
          supportsCodeExecution: true,
          supportsComputerUse: true,
          supportsFileSearch: true,
          supportsUrlContext: true,
          supportsLiveApi: false,
          supportsAudioGeneration: false,
          supportsImageGeneration: false,

          supportsBatch: true,
          supportsFlex: true,
          supportsPriority: true,

          maxContextTokens: 1048576,
          maxOutputTokens: 65536,

          supportsCustomSamplingParams: true,
          defaultTemperature: 0.7,

          knowledgeCutoff: "August 2026",
          releaseDate: "August 2026",
        },
        pricing: {
          standard: {
            inputCostPerMillion: 0.75,
            outputCostPerMillion: 3.75,
            cachedReadCostPerMillion: 0.075,
          },
          batch: {
            inputCostPerMillion: 0.375,
            outputCostPerMillion: 1.875,
            cachedReadCostPerMillion: 0.0375,
          },
          flex: {
            inputCostPerMillion: 0.375,
            outputCostPerMillion: 1.875,
            cachedReadCostPerMillion: 0.0375,
          },
          priority: {
            inputCostPerMillion: 0.75,
            outputCostPerMillion: 3.75,
            cachedReadCostPerMillion: 0.075,
          },
        },
        defaultTier: "standard",
      },
    },
  },
};
