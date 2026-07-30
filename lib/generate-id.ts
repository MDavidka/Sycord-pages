function generateNineDigitId(): string {
  // Generate a random 9-digit number
  return Math.floor(100000000 + Math.random() * 900000000).toString()
}

export { generateNineDigitId }
