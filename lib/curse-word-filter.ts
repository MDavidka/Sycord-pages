const CURSE_WORDS = [
  "damn",
  "hell",
  "crap",
  "piss",
  "shit",
  "fuck",
  "ass",
  "bitch",
  "bastard",
  "dick",
  "pussy",
  "whore",
  "slut",
  "fag",
  "faggot",
  "nigger",
  "retard",
  "dumbass",
  "asshole",
  "motherfucker",
]

export function containsCurseWords(text: string): boolean {
  const lowercaseText = text.toLowerCase()
  return CURSE_WORDS.some((word) => lowercaseText.includes(word))
}

export function getCurseWordsInText(text: string): string[] {
  const lowercaseText = text.toLowerCase()
  return CURSE_WORDS.filter((word) => lowercaseText.includes(word))
}
